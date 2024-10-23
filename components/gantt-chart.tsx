"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";


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
  const viewStart = months[0].startDate;
  const totalDays = months.reduce((acc, month) => acc + month.days, 0);

  const daysDiff = Math.floor((taskStart - viewStart) / (1000 * 60 * 60 * 24));
  const left = Math.max((daysDiff / totalDays) * 100, 0);
  const width = (duration / totalDays) * 100;

  return { left: `${left}%`, width: `${width}%` };
};

const calculatePhaseSpan = (tasks, months) => {
  if (!tasks.length) return null;

  const dates = tasks.map(task => {
    const start = new Date(task.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + task.duration);
    return { start, end };
  });

  const earliestStart = new Date(Math.min(...dates.map(d => d.start)));
  const latestEnd = new Date(Math.max(...dates.map(d => d.end)));

  const viewStart = months[0].startDate;
  const totalDays = months.reduce((acc, month) => acc + month.days, 0);

  const startDiff = Math.floor((earliestStart - viewStart) / (1000 * 60 * 60 * 24));
  const duration = Math.ceil((latestEnd - earliestStart) / (1000 * 60 * 60 * 24));

  const left = Math.max((startDiff / totalDays) * 100, 0);
  const width = (duration / totalDays) * 100;

  return { left: `${left}%`, width: `${width}%` };
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
  const [months, setMonths] = useState(generateMonths(1));
  const [sidebarWidth, setSidebarWidth] = useState('25%');
  const [isResizing, setIsResizing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');
  //const [isResizing, setIsResizing] = useState(false);


  // Save data to localStorage
  useEffect(() => {
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

  const removeTask = (phaseId: number, taskId: number) => {
    setPhases(phases.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          tasks: phase.tasks.filter(task => task.id !== taskId)
        };
      }
      return phase;
    }));
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
            style={{ marginBottom: '56px' }}
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
                      onClick={() => setPhases(phases.filter(p => p.id !== phase.id))}
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
                      style={{width: '35px'}}
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
                      onClick={() => removeTask(phase.id, task.id)}
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
          <div className="flex items-center p-4 gap-4">
            <button
              onClick={() => setMonths(generateMonths(months.length - 1))}
              className="p-2 rounded hover:bg-gray-100"
              disabled={months.length < 2}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setMonths(generateMonths(months.length + 1))}
              className="p-2 rounded hover:bg-gray-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex">
            {months.map((month, index) => (
              <div
                key={index}
                className="flex-1 p-2 text-center border-r border-gray-200"
                style={{ minWidth: `${month.days * 8}px` }}
              >
                {month.name} {month.year}
              </div>
            ))}
          </div>
          <div className="flex">
            {months.map((month, index) => (
              <div
                key={index}
                className="flex-1 border-r border-gray-200"
                style={{ minWidth: `${month.days * 8}px` }}
              >
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
                        width: phaseSpan.width
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
                      width: position.width
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}

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