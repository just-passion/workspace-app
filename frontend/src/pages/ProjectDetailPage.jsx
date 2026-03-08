import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../services/api';
import { getSocket } from '../hooks/useSocket';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const COLUMNS = ['backlog', 'todo', 'in_progress', 'done'];
const COL_LABELS = { backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const COL_COLORS = { backlog: '#4A5578', todo: '#F5A623', in_progress: '#4F6EF7', done: '#22D3A4' };
const PRIO_COLORS = { high: '#F87171', medium: '#F5A623', low: '#22D3A4' };

function TaskCard({ task, isDragging }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="task-card">
      <p className="task-card-title">{task.title}</p>
      <div className="task-card-footer">
        <span className="badge" style={{
          background: PRIO_COLORS[task.priority] + '1A',
          color: PRIO_COLORS[task.priority],
          borderColor: PRIO_COLORS[task.priority] + '40',
          borderRadius: '4px',
          fontSize: '10px',
        }}>{task.priority}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {task.dueDate && (
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.assigneeId && (
            <div className="avatar avatar-sm">{task.assigneeId?.[0]?.toUpperCase()}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id: projectId } = useParams();
  const qc = useQueryClient();
  const [activeTask, setActiveTask] = useState(null);
  const [showNewTask, setShowNewTask] = useState(null);
  const [newTitle, setNewTitle] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.get(`/projects/${projectId}/tasks`).then(r => r.data),
  });

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then(r => r.data),
  });

  const tasks = data?.tasks || [];
  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col] = tasks.filter(t => t.status === col);
    return acc;
  }, {});

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join_project', projectId);
    socket.on('task_created', () => qc.invalidateQueries(['tasks', projectId]));
    socket.on('task_updated', () => qc.invalidateQueries(['tasks', projectId]));
    socket.on('task_moved',   () => qc.invalidateQueries(['tasks', projectId]));
    return () => { socket.off('task_created'); socket.off('task_updated'); socket.off('task_moved'); };
  }, [projectId, qc]);

  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }) => api.patch(`/tasks/${taskId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries(['tasks', projectId]),
  });

  const createMutation = useMutation({
    mutationFn: ({ title, status }) => api.post('/tasks', { title, status, projectId }),
    onSuccess: () => { qc.invalidateQueries(['tasks', projectId]); setNewTitle(''); setShowNewTask(null); },
    onError: () => toast.error('Failed to create task'),
  });

  function handleDragStart({ active }) {
    setActiveTask(tasks.find(t => t._id === active.id));
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null);
    if (!over) return;
    const newStatus = over.id;
    const task = tasks.find(t => t._id === active.id);
    if (task && COLUMNS.includes(newStatus) && task.status !== newStatus) {
      moveMutation.mutate({ taskId: task._id, status: newStatus });
    }
  }

  return (
    <div className="page-scroll">
      <div className="page-header">
        <div>
          <h1 className="page-title">{projectData?.project?.name || 'Project'}</h1>
          <p className="page-subtitle">Kanban Board · {tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNewTask('todo')} className="btn btn-primary">
          <Plus size={14} /> Add Task
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="kanban-board">
          {COLUMNS.map(col => (
            <div key={col} id={col} className="kanban-column" style={{ borderTop: `2px solid ${COL_COLORS[col]}` }}>
              <div className="kanban-column-header">
                <span className="kanban-column-title" style={{ color: COL_COLORS[col] }}>{COL_LABELS[col]}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="kanban-column-count">{grouped[col]?.length}</span>
                  <button onClick={() => setShowNewTask(col)} className="btn btn-ghost" style={{ padding: '2px', color: 'var(--text-3)' }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="kanban-column-body">
                <SortableContext items={grouped[col]?.map(t => t._id) || []} strategy={verticalListSortingStrategy}>
                  {grouped[col]?.map(task => (
                    <TaskCard key={task._id} task={task} isDragging={activeTask?._id === task._id} />
                  ))}
                </SortableContext>

                {showNewTask === col && (
                  <div className="inline-task-form">
                    <input
                      autoFocus value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newTitle.trim()) createMutation.mutate({ title: newTitle.trim(), status: col });
                        if (e.key === 'Escape') setShowNewTask(null);
                      }}
                      style={{ width: '100%', background: 'transparent', color: 'var(--text-1)', fontSize: '13px', border: 'none', outline: 'none', fontFamily: 'Geist, sans-serif' }}
                      placeholder="Task name… (Enter to save, Esc to cancel)"
                    />
                  </div>
                )}

                <button onClick={() => setShowNewTask(col)} className="task-add-btn">+ Add task</button>
              </div>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
