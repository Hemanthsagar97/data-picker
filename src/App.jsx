import React, { useState, useContext, createContext, useCallback, useMemo } from 'react';
import { Calendar, Clock, Repeat, X, ChevronLeft, ChevronRight } from 'lucide-react';

// Context for state management
const RecurringDateContext = createContext();

// Types and enums
const RECURRENCE_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
};

const WEEKDAYS = [
  { key: 'sun', label: 'Sun', value: 0 },
  { key: 'mon', label: 'Mon', value: 1 },
  { key: 'tue', label: 'Tue', value: 2 },
  { key: 'wed', label: 'Wed', value: 3 },
  { key: 'thu', label: 'Thu', value: 4 },
  { key: 'fri', label: 'Fri', value: 5 },
  { key: 'sat', label: 'Sat', value: 6 }
];

const ORDINALS = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: -1, label: 'Last' }
];

// Helper functions
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const parseDate = (dateString) => {
  return new Date(dateString + 'T00:00:00');
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addWeeks = (date, weeks) => {
  return addDays(date, weeks * 7);
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const addYears = (date, years) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

const getWeekdayOfMonth = (date, ordinal, weekday) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  if (ordinal === -1) {
    // Last occurrence
    const lastDay = new Date(year, month + 1, 0);
    for (let day = lastDay.getDate(); day > 0; day--) {
      const testDate = new Date(year, month, day);
      if (testDate.getDay() === weekday) {
        return testDate;
      }
    }
  } else {
    // Nth occurrence
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const testDate = new Date(year, month, day);
      if (testDate.getMonth() !== month) break;
      if (testDate.getDay() === weekday) {
        count++;
        if (count === ordinal) {
          return testDate;
        }
      }
    }
  }
  return null;
};

// Main Provider Component
const RecurringDateProvider = ({ children }) => {
  const [state, setState] = useState({
    startDate: formatDate(new Date()),
    endDate: '',
    recurrenceType: RECURRENCE_TYPES.DAILY,
    interval: 1,
    selectedWeekdays: [],
    monthlyPattern: 'date', // 'date' or 'weekday'
    ordinal: 1,
    weekday: 1,
    isOpen: false
  });

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const generateRecurringDates = useCallback(() => {
    const { startDate, endDate, recurrenceType, interval, selectedWeekdays, monthlyPattern, ordinal, weekday } = state;
    const start = parseDate(startDate);
    const end = endDate ? parseDate(endDate) : addYears(start, 1);
    const dates = [];
    let current = new Date(start);
    let iterations = 0;
    const maxIterations = 1000; // Prevent infinite loops

    while (current <= end && iterations < maxIterations) {
      iterations++;
      
      switch (recurrenceType) {
        case RECURRENCE_TYPES.DAILY:
          dates.push(new Date(current));
          current = addDays(current, interval);
          break;
          
        case RECURRENCE_TYPES.WEEKLY:
          if (selectedWeekdays.length === 0) {
            dates.push(new Date(current));
            current = addWeeks(current, interval);
          } else {
            // Add dates for selected weekdays in current week
            const weekStart = new Date(current);
            weekStart.setDate(current.getDate() - current.getDay());
            
            selectedWeekdays.forEach(day => {
              const weekdayDate = new Date(weekStart);
              weekdayDate.setDate(weekStart.getDate() + day);
              if (weekdayDate >= start && weekdayDate <= end) {
                dates.push(new Date(weekdayDate));
              }
            });
            
            current = addWeeks(current, interval);
          }
          break;
          
        case RECURRENCE_TYPES.MONTHLY:
          if (monthlyPattern === 'date') {
            const targetDate = start.getDate();
            const newDate = new Date(current.getFullYear(), current.getMonth(), targetDate);
            if (newDate.getDate() === targetDate) {
              dates.push(newDate);
            }
          } else {
            const monthDate = getWeekdayOfMonth(current, ordinal, weekday);
            if (monthDate && monthDate >= start && monthDate <= end) {
              dates.push(monthDate);
            }
          }
          current = addMonths(current, interval);
          break;
          
        case RECURRENCE_TYPES.YEARLY:
          const yearDate = new Date(current.getFullYear(), start.getMonth(), start.getDate());
          if (yearDate.getDate() === start.getDate()) {
            dates.push(yearDate);
          }
          current = addYears(current, interval);
          break;
          
        default:
          break;
      }
    }

    return dates.sort((a, b) => a - b);
  }, [state]);

  const value = {
    ...state,
    updateState,
    generateRecurringDates
  };

  return (
    <RecurringDateContext.Provider value={value}>
      {children}
    </RecurringDateContext.Provider>
  );
};

const useRecurringDate = () => {
  const context = useContext(RecurringDateContext);
  if (!context) {
    throw new Error('useRecurringDate must be used within RecurringDateProvider');
  }
  return context;
};

// Date Input Component
const DateInput = ({ label, value, onChange, required = false }) => {
  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
};

// Recurrence Type Selector
const RecurrenceTypeSelector = () => {
  const { recurrenceType, updateState } = useRecurringDate();

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-medium text-gray-700">Repeat</label>
      <select
        value={recurrenceType}
        onChange={(e) => updateState({ recurrenceType: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value={RECURRENCE_TYPES.DAILY}>Daily</option>
        <option value={RECURRENCE_TYPES.WEEKLY}>Weekly</option>
        <option value={RECURRENCE_TYPES.MONTHLY}>Monthly</option>
        <option value={RECURRENCE_TYPES.YEARLY}>Yearly</option>
      </select>
    </div>
  );
};

// Interval Selector
const IntervalSelector = () => {
  const { recurrenceType, interval, updateState } = useRecurringDate();

  const getIntervalLabel = () => {
    switch (recurrenceType) {
      case RECURRENCE_TYPES.DAILY: return 'day(s)';
      case RECURRENCE_TYPES.WEEKLY: return 'week(s)';
      case RECURRENCE_TYPES.MONTHLY: return 'month(s)';
      case RECURRENCE_TYPES.YEARLY: return 'year(s)';
      default: return 'time(s)';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">Every</span>
      <input
        type="number"
        min="1"
        max="365"
        value={interval}
        onChange={(e) => updateState({ interval: parseInt(e.target.value) || 1 })}
        className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <span className="text-sm text-gray-600">{getIntervalLabel()}</span>
    </div>
  );
};

// Weekday Selector for Weekly Recurrence
const WeekdaySelector = () => {
  const { selectedWeekdays, updateState } = useRecurringDate();

  const toggleWeekday = (weekdayValue) => {
    const updated = selectedWeekdays.includes(weekdayValue)
      ? selectedWeekdays.filter(day => day !== weekdayValue)
      : [...selectedWeekdays, weekdayValue];
    updateState({ selectedWeekdays: updated });
  };

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-medium text-gray-700">Days of the week</label>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map(({ key, label, value }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleWeekday(value)}
            className={`px-3 py-1 text-sm rounded-full border-2 transition-colors ${
              selectedWeekdays.includes(value)
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Monthly Pattern Selector
const MonthlyPatternSelector = () => {
  const { monthlyPattern, ordinal, weekday, startDate, updateState } = useRecurringDate();

  const startDateObj = parseDate(startDate);
  const startWeekday = startDateObj.getDay();

  return (
    <div className="flex flex-col space-y-3">
      <label className="text-sm font-medium text-gray-700">Monthly pattern</label>
      
      <div className="space-y-2">
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            value="date"
            checked={monthlyPattern === 'date'}
            onChange={(e) => updateState({ monthlyPattern: e.target.value })}
            className="text-blue-500"
          />
          <span className="text-sm">On day {startDateObj.getDate()} of the month</span>
        </label>
        
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            value="weekday"
            checked={monthlyPattern === 'weekday'}
            onChange={(e) => updateState({ monthlyPattern: e.target.value })}
            className="text-blue-500"
          />
          <span className="text-sm">On the</span>
        </label>
      </div>

      {monthlyPattern === 'weekday' && (
        <div className="ml-6 flex items-center space-x-2">
          <select
            value={ordinal}
            onChange={(e) => updateState({ ordinal: parseInt(e.target.value) })}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            {ORDINALS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          
          <select
            value={weekday}
            onChange={(e) => updateState({ weekday: parseInt(e.target.value) })}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            {WEEKDAYS.map(({ label, value }) => (
              <option key={value} value={value}>{label}day</option>
            ))}
          </select>
          
          <span className="text-sm text-gray-600">of the month</span>
        </div>
      )}
    </div>
  );
};

// Mini Calendar Preview
const MiniCalendar = () => {
  const { generateRecurringDates } = useRecurringDate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const recurringDates = useMemo(() => {
    return generateRecurringDates().slice(0, 50); // Limit for performance
  }, [generateRecurringDates]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isRecurringDate = (date) => {
    if (!date) return false;
    return recurringDates.some(recurringDate => {
      return formatDate(recurringDate) === formatDate(date);
    });
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + direction);
      return newMonth;
    });
  };

  const days = getDaysInMonth(currentMonth);
  const monthYear = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Preview</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium">{monthYear}</span>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(({ label }) => (
          <div key={label} className="text-xs font-medium text-gray-500 py-2">
            {label}
          </div>
        ))}
        
        {days.map((date, index) => (
          <div
            key={index}
            className={`aspect-square flex items-center justify-center text-sm relative ${
              date
                ? isRecurringDate(date)
                  ? 'bg-blue-500 text-white rounded-full font-medium'
                  : 'text-gray-700 hover:bg-gray-100 rounded'
                : ''
            }`}
          >
            {date && date.getDate()}
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Showing up to 50 recurring dates
      </div>
    </div>
  );
};

// Main Recurring Date Picker Component
const RecurringDatePicker = ({ onSave, onCancel }) => {
  const {
    startDate,
    endDate,
    recurrenceType,
    updateState,
    generateRecurringDates
  } = useRecurringDate();

  const handleSave = () => {
    const dates = generateRecurringDates();
    onSave && onSave({
      startDate,
      endDate,
      recurrenceType,
      dates
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Repeat className="text-blue-500" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Recurring Date Picker</h2>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInput
              label="Start Date"
              value={startDate}
              onChange={(value) => updateState({ startDate: value })}
              required
            />
            <DateInput
              label="End Date (Optional)"
              value={endDate}
              onChange={(value) => updateState({ endDate: value })}
            />
          </div>

          {/* Recurrence Settings */}
          <div className="space-y-4">
            <RecurrenceTypeSelector />
            <IntervalSelector />
            
            {recurrenceType === RECURRENCE_TYPES.WEEKLY && <WeekdaySelector />}
            {recurrenceType === RECURRENCE_TYPES.MONTHLY && <MonthlyPatternSelector />}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Save Recurrence
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div>
          <MiniCalendar />
        </div>
      </div>
    </div>
  );
};

// Demo Component
const App = () => {
  const [savedRecurrence, setSavedRecurrence] = useState(null);

  const handleSave = (recurrenceData) => {
    setSavedRecurrence(recurrenceData);
    alert(`Saved! Generated ${recurrenceData.dates.length} recurring dates.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Recurring Date Picker Component
          </h1>
          <p className="text-gray-600">
            A comprehensive React component for selecting recurring dates with advanced patterns
          </p>
        </div>

        <RecurringDateProvider>
          <RecurringDatePicker onSave={handleSave} />
        </RecurringDateProvider>

        {savedRecurrence && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-semibold mb-3">Last Saved Configuration:</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Start Date: {savedRecurrence.startDate}</p>
              <p>End Date: {savedRecurrence.endDate || 'No end date'}</p>
              <p>Recurrence Type: {savedRecurrence.recurrenceType}</p>
              <p>Generated Dates: {savedRecurrence.dates.length}</p>
              <p>First few dates: {savedRecurrence.dates.slice(0, 5).map(date => 
                date.toLocaleDateString()).join(', ')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;