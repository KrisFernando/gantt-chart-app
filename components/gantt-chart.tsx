"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { markAsUntransferable } from "worker_threads";

const generateMonths = (count = 1) => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      name: date.toLocaleString('default', { month: 'short' }),
      year: date.getFullYear(),
      month: date.getMonth(),
      days: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      startDate: date
    });
  }
  return months;
};

const calculateTaskPosition = (startDate, duration, months) => {
  const taskStart = new Date(startDate);
  taskStart.setHours(0, 0, 0, 0);

  // Find which month this task belongs to
  let monthIndex = -1;
  let daysBeforeTask = 0;
  let totalDays = 0;

  for (let i = 0; i < months.length; i++) {
    const monthStart = new Date(months[i].year, months[i].month, 1);
    const monthEnd = new Date(months[i].year, months[i].month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    if (taskStart >= monthStart && taskStart <= monthEnd) {
      monthIndex = i;
      break;
    }
    daysBeforeTask += months[i].days;
  }

  // Calculate total days in view
  totalDays = months.reduce((acc, month) => acc + month.days, 0);

  // If task starts in visible months
  if (monthIndex >= 0) {
    const monthStart = new Date(months[monthIndex].year, months[monthIndex].month, 1);
    const dayInMonth = taskStart.getDate() - 1; // -1 because dates are 1-based
    const daysFromStart = daysBeforeTask + dayInMonth;

    const left = (daysFromStart / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return { left: `${left}%`, width: `${width}%` };
  }

  // If task starts before visible range
  return { left: '0%', width: '0%' };
};

const calculatePhaseSpan = (tasks, months) => {
  if (!tasks.length) return null;

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const viewStart = new Date(firstMonth.year, firstMonth.month, 1);
  const viewEnd = new Date(lastMonth.year, lastMonth.month + 1, 0);
  
  const totalDays = months.reduce((acc, month) => acc + month.days, 0);
  
  // Find earliest start and latest end
  let earliestStart = null;
  let latestEnd = null;
  
  tasks.forEach(task => {
    const taskStart = new Date(task.startDate);
    taskStart.setHours(0, 0, 0, 0);
    const taskEnd = new Date(taskStart);
    taskEnd.setDate(taskStart.getDate() + task.duration);
    
    if (!earliestStart || taskStart < earliestStart) earliestStart = taskStart;
    if (!latestEnd || taskEnd > latestEnd) latestEnd = taskEnd;
  });
  
  if (!earliestStart || !latestEnd) return null;

  // Calculate days from view start to task start
  let daysFromViewStart = 0;
  let currentDate = new Date(viewStart);
  
  while (currentDate < earliestStart) {
    currentDate.setDate(currentDate.getDate() + 1);
    daysFromViewStart++;
  }

  // Calculate total duration
  const duration = Math.ceil((latestEnd - earliestStart) / (1000 * 60 * 60 * 24));
  
  // Calculate position
  const left = (daysFromViewStart / totalDays) * 100;
  const width = (duration / totalDays) * 100;
  
  return { 
    left: `${Math.max(0, left)}%`, 
    width: `${Math.min(width, 100 - Math.max(0, left))}%` 
  };
};

const defaultColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB',
  '#E67E22', '#2ECC71', '#F1C40F', '#E74C3C'
];

const GanttChart = () => {
  // Initialize refs
  const containerRef = useRef(null);
  const sidebarRef = useRef(null);

  // Initialize state
  const [phases, setPhases] = useState(() => {
    try {
      const saved = localStorage.getItem('ganttData');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isClient, setIsClient] = useState(false)
  const [months, setMonths] = useState(generateMonths(1));
  const [sidebarWidth, setSidebarWidth] = useState('25%');
  const [isResizing, setIsResizing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');
  const [showDeletePhaseDialog, setShowDeletePhaseDialog] = useState(false);
  const [showDeleteTaskDialog, setShowDeleteTaskDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showRemoveMonthDialog, setShowRemoveMonthDialog] = useState(false);
  const [monthToRemove, setMonthToRemove] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(null);


  // Save data to localStorage

  useEffect(() => {
    setIsClient(true);
    localStorage.setItem('ganttData', JSON.stringify(phases));
  }, [phases]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const containerWidth = containerRect.width;
      const widthPercentage = (newWidth / containerWidth) * 100;
      const constrainedWidth = Math.min(Math.max(widthPercentage, 15), 50);
      setSidebarWidth(`${constrainedWidth}%`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const addPhase = () => {
    setPhases(prev => [...prev, {
      id: Date.now(),
      name: 'New Phase',
      color: defaultColors[phases.length % defaultColors.length],
      tasks: []
    }]);
  };

  const addTask = (phaseId) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          tasks: [...p.tasks, {
            id: Date.now(),
            name: 'New Task',
            startDate: new Date().toISOString().split('T')[0],
            duration: 5
          }]
        };
      }
      return p;
    }));
  };

  const updatePhase = (phaseId, updates) => {
    setPhases(phases.map(phase =>
      phase.id === phaseId ? { ...phase, ...updates } : phase
    ));
  };

  const handlePhaseDeleteClick = (phaseId) => {
    setItemToDelete({ type: 'phase', id: phaseId });
    setShowDeletePhaseDialog(true);
  };

  const handleTaskDeleteClick = (phaseId, taskId) => {
    setItemToDelete({ type: 'task', phaseId, taskId });
    setShowDeleteTaskDialog(true);
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'phase') {
      setPhases(phases.filter(p => p.id !== itemToDelete.id));
    } else if (itemToDelete.type === 'task') {
      setPhases(phases.map(phase => {
        if (phase.id === itemToDelete.phaseId) {
          return {
            ...phase,
            tasks: phase.tasks.filter(task => task.id !== itemToDelete.taskId)
          };
        }
        return phase;
      }));
    }

    setShowDeletePhaseDialog(false);
    setShowDeleteTaskDialog(false);
    setItemToDelete(null);
  };

  const addMonthAfter = (index) => {
    const referenceMonth = months[index];
    // Create a date object for the first day of the next month
    const newDate = new Date(referenceMonth.year, referenceMonth.month + 1, 1);

    // Check if this month already exists
    const exists = months.some(m =>
      m.year === newDate.getFullYear() &&
      m.month === newDate.getMonth()
    );

    if (!exists) {
      const newMonth = {
        name: newDate.toLocaleString('default', { month: 'short' }),
        year: newDate.getFullYear(),
        month: newDate.getMonth(),
        days: new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate(),
        startDate: newDate
      };

      const newMonths = [...months];
      newMonths.splice(index + 1, 0, newMonth);
      setMonths(newMonths);
    }
  };

  const removeMonth = (index) => {
    if (months.length <= 1) return; // Prevent removing last month
    setMonths(months.filter((_, i) => i !== index));
  };

  const getNextMonth = (year, month) => {
    const nextDate = new Date(year, month + 1, 1);
    return {
      year: nextDate.getFullYear(),
      month: nextDate.getMonth()
    };
  };

  return (
    <div ref={containerRef} className="flex h-screen bg-gray-100 relative">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="border-r border-gray-200 bg-white relative"
        style={{ width: sidebarWidth }}
      >
        <div className="p-4">
          <button
            onClick={addPhase}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Plus size={16} /> Add Phase
          </button>
        </div>

        <div className="overflow-y-auto">
          {phases.map(phase => (
            <div key={phase.id} className="border-b border-gray-200">
              {/* Phase Header */}
              <div className="p-4 h-12 bg-gray-50">
                <div className="flex items-center justify-between">
                  <input
                    value={phase.name}
                    onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                    className="font-semibold bg-transparent"
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full cursor-pointer"
                      style={{ backgroundColor: phase.color }}
                      onClick={() => {
                        setSelectedItem({ type: 'phase', id: phase.id });
                        setShowColorPicker(true);
                      }}
                    />
                    <button
                      onClick={() => addTask(phase.id)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => handlePhaseDeleteClick(phase.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              {phase.tasks.map(task => (
                <div key={task.id} className="h-12 border-t border-gray-100 flex items-center px-4">
                  <div className="flex items-center gap-2 w-full">
                    <input
                      value={task.name}
                      onChange={(e) => {
                        setPhases(phases.map(p => {
                          if (p.id === phase.id) {
                            return {
                              ...p,
                              tasks: p.tasks.map(t =>
                                t.id === task.id ? { ...t, name: e.target.value } : t
                              )
                            };
                          }
                          return p;
                        }));
                      }}
                      className="flex-1 bg-transparent"
                    />
                    <input
                      type="date"
                      value={task.startDate}
                      style={{ width: '105px' }}
                      onChange={(e) => {
                        setPhases(phases.map(p => {
                          if (p.id === phase.id) {
                            return {
                              ...p,
                              tasks: p.tasks.map(t =>
                                t.id === task.id ? { ...t, startDate: e.target.value } : t
                              )
                            };
                          }
                          return p;
                        }));
                      }}
                      className="text-sm"
                    />
                    <input
                      type="number"
                      value={task.duration}
                      style={{ width: '35px', textAlign: 'right' }}
                      onChange={(e) => {
                        setPhases(phases.map(p => {
                          if (p.id === phase.id) {
                            return {
                              ...p,
                              tasks: p.tasks.map(t =>
                                t.id === task.id ? { ...t, duration: parseInt(e.target.value) } : t
                              )
                            };
                          }
                          return p;
                        }));
                      }}
                      className="w-16 text-sm"
                      min="1"
                    />
                    <button
                      onClick={() => handleTaskDeleteClick(phase.id, task.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="absolute h-full cursor-col-resize select-none"
        style={{
          left: sidebarWidth,
          width: '5px',
          transform: 'translateX(-50%)',
          background: isResizing ? 'rgba(0,0,0,0.1)' : 'transparent',
          zIndex: 10
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="h-full w-1 bg-gray-300 opacity-0 hover:opacity-100 transition-opacity"
          style={{ opacity: isResizing ? 1 : undefined }}
        />
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-x-auto">
        {/* Month Headers */}
        <div className="sticky top-0 bg-white border-b border-gray-200">
          <div className="flex">
            {months.map((month, index) => (
              <div
                key={index}
                className="flex-1 border-r border-gray-200"
                style={{ minWidth: `${month.days * 8}px` }}
              >
                <div className="p-2 flex items-center justify-between"
                style={{marginTop: '8px'}}>
                  <span className="flex-1 text-center">
                    {month.name} {month.year}
                  </span>
                  <div className="flex gap-2">
                  {months.length > 1 && (index === 0 || index === months.length - 1) && (
                      <button
                        onClick={() => {
                          setMonthToRemove({ index, name: month.name });
                          setShowRemoveMonthDialog(true);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={14} />
                      </button>
                    )}                    
                    {(() => {
                      // Get next month's info
                      const nextDate = new Date(month.year, month.month + 1, 1);
                      const nextYear = nextDate.getFullYear();
                      const nextMonth = nextDate.getMonth();

                      // Check if next month exists in our months array
                      const nextMonthExists = months.some(m =>
                        m.year === nextYear && m.month === nextMonth
                      );

                      // Only show + button if next month doesn't exist
                      if (!nextMonthExists) {
                        return (
                          <button
                            onClick={() => addMonthAfter(index)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Plus size={14} />
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${month.days}, 1fr)` }}>
                  {Array.from({ length: month.days }).map((_, day) => (
                    <div key={day} className="h-6 border-r border-gray-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase and Task Rows */}
        {phases.map(phase => (
          <div key={phase.id}>
            {/* Phase Summary Bar */}
            <div className="h-12 bg-gray-50 border-b border-gray-200 relative">
              {(() => {
                const phaseSpan = calculatePhaseSpan(phase.tasks, months);
                if (phaseSpan) {
                  return (
                    <div
                      className="absolute h-6 top-3 rounded opacity-50"
                      style={{
                        backgroundColor: phase.color,
                        left: phaseSpan.left,
                        width: phaseSpan.width,
                        marginTop: '2px'
                      }}
                    />
                  );
                }
                return null;
              })()}
            </div>

            {/* Task Bars */}
            {phase.tasks.map(task => {
              const position = calculateTaskPosition(task.startDate, task.duration, months);
              return (
                <div key={task.id} className="h-12 border-t border-gray-100 relative">
                  <div
                    className="absolute h-6 top-3 rounded"
                    style={{
                      backgroundColor: phase.color,
                      left: position.left,
                      width: position.width,
                      marginBottom: '2px'
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}

        {/* Add Month Dialog */}
        <AlertDialog open={showRemoveMonthDialog} onOpenChange={setShowRemoveMonthDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Month</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {monthToRemove?.name || ''}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowRemoveMonthDialog(false);
                setMonthToRemove(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (monthToRemove !== null) {
                    removeMonth(monthToRemove.index);
                  }
                  setShowRemoveMonthDialog(false);
                  setMonthToRemove(null);
                }}
                className="bg-red-500 hover:bg-red-600"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove Month Dialog */}
        <AlertDialog open={showRemoveMonthDialog} onOpenChange={setShowRemoveMonthDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Month</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {selectedMonthIndex !== null ? months[selectedMonthIndex].name : ''}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowRemoveMonthDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedMonthIndex !== null) {
                    removeMonth(selectedMonthIndex);
                  }
                  setShowRemoveMonthDialog(false);
                }}
                className="bg-red-500 hover:bg-red-600"
              >
                Remove Month
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {/* Delete Phase Confirmation Dialog */}
        <AlertDialog open={showDeletePhaseDialog} onOpenChange={setShowDeletePhaseDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Phase</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this phase? This action cannot be undone, and all tasks within this phase will be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeletePhaseDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Task Confirmation Dialog */}
        <AlertDialog open={showDeleteTaskDialog} onOpenChange={setShowDeleteTaskDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this task? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteTaskDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Color picker modal */}
        {showColorPicker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {defaultColors.map(color => (
                  <div
                    key={color}
                    className="w-8 h-8 rounded-full cursor-pointer"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      if (selectedItem?.type === 'phase') {
                        updatePhase(selectedItem.id, { color });
                      }
                      setShowColorPicker(false);
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (selectedItem?.type === 'phase') {
                      updatePhase(selectedItem.id, { color: customColor });
                    }
                    setShowColorPicker(false);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Use Custom Color
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overlay when resizing */}
        {isResizing && (
          <div className="fixed inset-0 bg-transparent" style={{ cursor: 'col-resize' }} />
        )}

      </div>
    </div>
  );
};

export default GanttChart;