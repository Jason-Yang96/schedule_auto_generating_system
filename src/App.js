import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  User,
  Calendar,
  X,
  RotateCcw,
  UserPlus,
  Wand2,
  Settings,
} from 'lucide-react';
import './ScheduleSystem.css';

/* =========================
   유틸리티 & 규칙
   ========================= */

const isWeekend = (day) => day === '토요일' || day === '일요일';

// 가중 랜덤(남은시간 + 난수)으로 스코어링된 후보 중 최상위 선택
const pickTopByScore = (scored) =>
  scored.length ? scored.sort((a, b) => b.score - a.score)[0].person : null;

/** 특정 요일에 어떤 슬롯(id)들에 배치돼 있는지 반환 (오름차순) */
const getDayAssignedSlots = (schedule, day, personName) => {
  const slots = [];
  (schedule[day] || []).forEach((s) => {
    if (s.assigned.some((p) => p.name === personName)) slots.push(s.id);
  });
  return slots.sort((a, b) => a - b);
};

/**
 * 평일 패턴 유효성 체크
 * - 길이 1: OK (2h)
 * - 길이 2: 인접해야 함 (4h는 붙여서)
 * - 길이 3: (a,b,c) 오름차순에서
 *    (b==a+1 && c>=b+2)  => 4h 연속 + 2h는 최소 1슬롯(2h) 떨어짐
 *  OR(c==b+1 && a<=b-2)  => 2h + 최소 1슬롯(2h) 휴게 + 4h 연속
 * - 그 외(4개 이상)는 불가(평일 하루 6h 제한)
 */
const isWeekdayPatternValid = (orderedSlots) => {
  const n = orderedSlots.length;
  if (n <= 1) return true;
  if (n === 2) return Math.abs(orderedSlots[1] - orderedSlots[0]) === 1;
  if (n === 3) {
    const [a, b, c] = orderedSlots;
    const case1 = b === a + 1 && c >= b + 2; // 4h 붙여 + (>=2h 휴게) + 2h
    const case2 = c === b + 1 && a <= b - 2; // 2h + (>=2h 휴게) + 4h 붙여
    return case1 || case2;
  }
  return false;
};

/** 해당 슬롯 배치 가능 여부(주말 규칙/평일 6h/패턴/토글 반영) */
const canAssignWithRules = ({
  schedule,
  day,
  person,
  slotId,
  dailyHours,
  enforceContiguity, // 새 옵션
}) => {
  if (person.remainingHours < 2) return false;

  const daySchedule = schedule[day];
  const slot = daySchedule.find((s) => s.id === slotId);
  if (slot.assigned.some((p) => p.name === person.name)) return false;

  // 주말: 1일 6h 제한 없음, 패턴 제약 해제(연속 6h 이상 가능)
  if (isWeekend(day)) return true;

  // 평일: 1일 6h 제한
  if (dailyHours[day][person.name] >= 6) return false;

  // 평일 패턴: 토글 ON일 때만 강제
  if (!enforceContiguity) return true;

  const existing = getDayAssignedSlots(schedule, day, person.name);
  const next = [...existing, slotId].sort((a, b) => a - b);
  return isWeekdayPatternValid(next);
};

const ScheduleSystem = () => {
  const daysOfWeek = [
    '월요일',
    '화요일',
    '수요일',
    '목요일',
    '금요일',
    '토요일',
    '일요일',
  ];
  const weekdays = ['월요일', '화요일', '수요일', '목요일', '금요일'];

  const initialPeople = [
    { name: '수경', totalHours: 28, remainingHours: 28, color: 'color-blue' },
    { name: '윤재', totalHours: 28, remainingHours: 28, color: 'color-green' },
    { name: '은서', totalHours: 28, remainingHours: 28, color: 'color-purple' },
    { name: '수희', totalHours: 28, remainingHours: 28, color: 'color-pink' },
    { name: '영중', totalHours: 28, remainingHours: 28, color: 'color-yellow' },
    { name: '병철', totalHours: 28, remainingHours: 28, color: 'color-indigo' },
    { name: '지은', totalHours: 28, remainingHours: 28, color: 'color-red' },
    { name: '준혁', totalHours: 14, remainingHours: 14, color: 'color-orange' },
    { name: '기환', totalHours: 8, remainingHours: 8, color: 'color-teal' },
    { name: '병택', totalHours: 8, remainingHours: 8, color: 'color-cyan' },
    { name: '재선', totalHours: 8, remainingHours: 8, color: 'color-emerald' },
  ];

  const [people, setPeople] = useState(initialPeople.map((p) => ({ ...p })));
  const [showSettings, setShowSettings] = useState(false);
  const [editingHours, setEditingHours] = useState(false);

  // ✅ 새 옵션: 평일 연속 강제 여부
  const [enforceContiguity, setEnforceContiguity] = useState(true);

  const [requiredStaff, setRequiredStaff] = useState({
    1: 2,
    2: 3,
    3: 3,
    4: 3,
    5: 3,
    6: 3,
    7: 2,
  });

  const createTimeSlots = () => [
    { id: 1, start: '07:00', end: '09:00', assigned: [] },
    { id: 2, start: '09:00', end: '11:00', assigned: [] },
    { id: 3, start: '11:00', end: '13:00', assigned: [] },
    { id: 4, start: '13:00', end: '15:00', assigned: [] },
    { id: 5, start: '15:00', end: '17:00', assigned: [] },
    { id: 6, start: '17:00', end: '19:00', assigned: [] },
    { id: 7, start: '19:00', end: '21:00', assigned: [] },
  ];

  const initWeekSchedule = () => {
    const schedule = {};
    daysOfWeek.forEach((day) => {
      schedule[day] = createTimeSlots();
    });
    return schedule;
  };

  const [weekSchedule, setWeekSchedule] = useState(initWeekSchedule());
  const [draggedPerson, setDraggedPerson] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSelectedCell(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 자동 스케줄링 (이미 배치된 슬롯 유지 + 평일 규칙/토글 반영, 주말은 그대로)
  const autoSchedule = () => {
    const confirmAuto = window.confirm(
      '현재 스케줄을 유지한 채, 부족한 자리만 자동으로 채울까요? (주중/주말 기존 배치는 변경되지 않습니다)'
    );
    if (!confirmAuto) return;

    // 1) 현재 스케줄 깊은 복사
    const newSchedule = {};
    daysOfWeek.forEach((day) => {
      newSchedule[day] = weekSchedule[day].map((s) => ({
        ...s,
        assigned: [...s.assigned],
      }));
    });

    // 2) 현재 전체 배치 기준 남은시간 재계산
    const currentAssignedHours = {};
    daysOfWeek.forEach((day) => {
      weekSchedule[day].forEach((slot) => {
        slot.assigned.forEach((person) => {
          currentAssignedHours[person.name] =
            (currentAssignedHours[person.name] || 0) + 2;
        });
      });
    });

    let updatedPeople = people.map((p) => ({
      ...p,
      remainingHours: p.totalHours - (currentAssignedHours[p.name] || 0),
    }));

    // 3) 일일 사용 시간 초기화 (이미 배치 반영)
    const dailyHours = {};
    daysOfWeek.forEach((day) => {
      dailyHours[day] = {};
      updatedPeople.forEach((person) => {
        let used = 0;
        newSchedule[day].forEach((slot) => {
          if (slot.assigned.some((p) => p.name === person.name)) used += 2;
        });
        dailyHours[day][person.name] = used;
      });
    });

    // 4) 평일만 부족분 충원 (주말은 유지)
    const weekdaysSet = new Set(weekdays);
    weekdays.forEach((day) => {
      if (!weekdaysSet.has(day)) return;

      newSchedule[day].forEach((slot) => {
        const required = requiredStaff[slot.id] || 0;
        const already = slot.assigned.length;
        const need = Math.max(0, required - already);
        if (need === 0) return;

        const additions = [];
        for (let i = 0; i < need; i++) {
          // 후보 필터: 패턴/6h/잔여시간/토글 반영
          const candidates = updatedPeople.filter((person) => {
            if (additions.some((p) => p.name === person.name)) return false; // 이번 슬롯 내 중복 방지
            if (slot.assigned.some((p) => p.name === person.name)) return false; // 이미 이 슬롯 참여
            return canAssignWithRules({
              schedule: newSchedule,
              day,
              person,
              slotId: slot.id,
              dailyHours,
              enforceContiguity,
            });
          });

          if (candidates.length === 0) break;

          // 인접 슬롯 보너스(연속 유도) + 가중 랜덤
          const scored = candidates.map((p) => {
            const existing = getDayAssignedSlots(newSchedule, day, p.name);
            const hasAdjacent = existing.some((id) => Math.abs(id - slot.id) === 1);
            let score = p.remainingHours + Math.random();
            if (enforceContiguity && hasAdjacent) score += 0.6;
            return { person: p, score };
          });

          const selected = pickTopByScore(scored);
          if (!selected) break;

          additions.push(selected);
          // 상태 갱신
          const idx = updatedPeople.findIndex((p) => p.name === selected.name);
          updatedPeople[idx].remainingHours -= 2;
          dailyHours[day][selected.name] += 2;
        }

        if (additions.length > 0) {
          slot.assigned = [...slot.assigned, ...additions];
        }
      });
    });

    setWeekSchedule(newSchedule);
    setPeople(updatedPeople);
    alert('자동 스케줄링이 완료되었습니다! (기존 배치는 유지됨)');
  };

  // 필요 인원 변경
  const updateRequiredStaff = (slotId, value) => {
    setRequiredStaff((prev) => ({
      ...prev,
      [slotId]: parseInt(value) || 0,
    }));
  };

  // 인원별 총 가능 시간 변경
  const updatePersonHours = (personName, hours) => {
    const newHours = parseInt(hours) || 0;
    let assignedHours = 0;
    daysOfWeek.forEach((day) => {
      weekSchedule[day].forEach((slot) => {
        if (slot.assigned.some((p) => p.name === personName)) assignedHours += 2;
      });
    });
    if (newHours < assignedHours) {
      alert(
        `${personName}님은 이미 ${assignedHours}시간이 배치되어 있어 ${newHours}시간으로 변경할 수 없습니다.`
      );
      return;
    }
    setPeople((prev) =>
      prev.map((p) =>
        p.name === personName
          ? {
              ...p,
              totalHours: newHours,
              remainingHours: newHours - assignedHours,
            }
          : p
      )
    );
  };

  // 드래그/드롭
  const handleDragStart = (person) => setDraggedPerson(person);
  const handleDragEnd = () => {
    setDraggedPerson(null);
    setHoveredCell(null);
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnter = (day, slotId) => setHoveredCell(`${day}-${slotId}`);

  const handleDrop = (e, day, slotId) => {
    e.preventDefault();
    setHoveredCell(null);
    if (!draggedPerson) return;
    assignPersonToSlot(draggedPerson, day, slotId);
    setDraggedPerson(null);
  };

  // 셀 클릭/드롭다운
  const handleCellClick = (e, day, slotId) => {
    e.stopPropagation();
    const cellId = `${day}-${slotId}`;
    if (selectedCell === cellId && showDropdown) {
      setShowDropdown(false);
      setSelectedCell(null);
    } else {
      setSelectedCell(cellId);
      setShowDropdown(true);
    }
  };
  const handlePersonSelect = (person) => {
    if (!selectedCell) return;
    const [day, slotId] = selectedCell.split('-');
    assignPersonToSlot(person, day, parseInt(slotId));
    setShowDropdown(false);
    setSelectedCell(null);
  };

  // 수동 배치 (주말 완화 / 평일 토글 반영)
  const assignPersonToSlot = (person, day, slotId) => {
    if (person.remainingHours < 2) {
      alert(`${person.name}님의 남은 시간이 부족합니다.`);
      return;
    }
    const daySchedule = weekSchedule[day];
    const slot = daySchedule.find((s) => s.id === slotId);
    if (slot.assigned.some((p) => p.name === person.name)) {
      alert(`${person.name}님은 이미 이 시간대에 배치되어 있습니다.`);
      return;
    }

    // 일일 사용 시간
    const dayUsed = daySchedule.reduce(
      (acc, s) => acc + (s.assigned.some((p) => p.name === person.name) ? 2 : 0),
      0
    );

    // 평일만 6h 제한
    if (!isWeekend(day) && dayUsed >= 6) {
      alert('평일에는 하루 최대 6시간을 초과할 수 없습니다.');
      return;
    }

    // 평일 패턴: 토글 ON일 때만 강제
    if (!isWeekend(day) && enforceContiguity) {
      const existing = getDayAssignedSlots(weekSchedule, day, person.name);
      const next = [...existing, slotId].sort((a, b) => a - b);
      if (!isWeekdayPatternValid(next)) {
        alert('평일 패턴(4h는 붙여서 / 6h=4+휴게+2 또는 2+휴게+4)에 맞지 않습니다.');
        return;
      }
    }

    // 반영
    const updatedWeekSchedule = { ...weekSchedule };
    updatedWeekSchedule[day] = daySchedule.map((s) =>
      s.id === slotId ? { ...s, assigned: [...s.assigned, person] } : s
    );
    const updatedPeople = people.map((p) =>
      p.name === person.name ? { ...p, remainingHours: p.remainingHours - 2 } : p
    );

    setWeekSchedule(updatedWeekSchedule);
    setPeople(updatedPeople);
  };

  // 배치 제거
  const removePerson = (day, slotId, personName) => {
    const updatedWeekSchedule = { ...weekSchedule };
    updatedWeekSchedule[day] = weekSchedule[day].map((slot) =>
      slot.id === slotId
        ? {
            ...slot,
            assigned: slot.assigned.filter((p) => p.name !== personName),
          }
        : slot
    );
    const updatedPeople = people.map((person) =>
      person.name === personName
        ? { ...person, remainingHours: person.remainingHours + 2 }
        : person
    );
    setWeekSchedule(updatedWeekSchedule);
    setPeople(updatedPeople);
  };

  // 초기화
  const resetAllSchedule = () => {
    const confirmReset = window.confirm('전체 주간 스케줄을 초기화하시겠습니까?');
    if (confirmReset) {
      setWeekSchedule(initWeekSchedule());
      setPeople([...initialPeople.map((p) => ({ ...p }))]);
      setShowDropdown(false);
      setSelectedCell(null);
    }
  };
  const resetDaySchedule = (day) => {
    const confirmReset = window.confirm(`${day} 스케줄을 초기화하시겠습니까?`);
    if (!confirmReset) return;
    const daySchedule = weekSchedule[day];
    let updatedPeople = [...people];
    daySchedule.forEach((slot) => {
      slot.assigned.forEach((person) => {
        updatedPeople = updatedPeople.map((p) =>
          p.name === person.name ? { ...p, remainingHours: p.remainingHours + 2 } : p
        );
      });
    });
    const updatedWeekSchedule = { ...weekSchedule };
    updatedWeekSchedule[day] = createTimeSlots();
    setWeekSchedule(updatedWeekSchedule);
    setPeople(updatedPeople);
  };

  // 통계
  const calculateStats = () => {
    const stats = {};
    people.forEach((person) => {
      stats[person.name] = { ...person, dailyHours: {}, totalAssigned: 0 };
    });
    daysOfWeek.forEach((day) => {
      weekSchedule[day].forEach((slot) => {
        slot.assigned.forEach((person) => {
          stats[person.name].dailyHours[day] =
            (stats[person.name].dailyHours[day] || 0) + 2;
          stats[person.name].totalAssigned += 2;
        });
      });
    });
    return stats;
  };

  const stats = calculateStats();
  const totalAssignedHours = Object.values(stats).reduce(
    (acc, person) => acc + person.totalAssigned,
    0
  );

  // 우측 패널 그룹
  const groupedPeople = {
    '28시간': people.filter((p) => p.totalHours === 28),
    '14시간': people.filter((p) => p.totalHours === 14),
    '8시간': people.filter((p) => p.totalHours === 8),
  };

  // 드롭다운 위치
  const getDropdownPosition = () => {
    if (!selectedCell) return {};
    const element = document.getElementById(`cell-${selectedCell}`);
    if (element) {
      const rect = element.getBoundingClientRect();
      return {
        position: 'fixed',
        top: `${rect.bottom + 5}px`,
        left: `${rect.left}px`,
        zIndex: 1000,
      };
    }
    return {};
  };

  return (
    <div className="app">
      <div className="container">
        {/* 헤더 */}
        <div className="card header">
          <div className="header-row">
            <h1 className="title">
              <Calendar className="icon-lg text-blue" />
              주간 근무 스케줄 시스템
            </h1>
            <div className="header-actions">
              <div className="total-chip">
                <span className="muted">총 배치: </span>
                <span className="emphasis">{totalAssignedHours}시간</span>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn btn-gray"
              >
                <Settings className="icon-sm" /> 설정
              </button>
              <button onClick={autoSchedule} className="btn btn-green">
                <Wand2 className="icon-sm" /> 자동 배치
              </button>
              <button onClick={resetAllSchedule} className="btn btn-red">
                <RotateCcw className="icon-sm" /> 전체 초기화
              </button>
            </div>
          </div>
        </div>

        {/* 설정 패널 */}
        {showSettings && (
          <div className="card settings">
            <div className="grid-2">
              <div>
                <h3 className="section-title">
                  <Clock className="icon-sm" /> 시간대별 필요 인원
                </h3>
                <div className="v-stack-8">
                  {createTimeSlots().map((slot) => (
                    <div key={slot.id} className="slot-config">
                      <span className="slot-label">
                        {slot.start} - {slot.end}
                      </span>
                      <select
                        value={requiredStaff[slot.id] || 0}
                        onChange={(e) =>
                          updateRequiredStaff(slot.id, e.target.value)
                        }
                        className="select"
                      >
                        {[0, 1, 2, 3, 4, 5].map((num) => (
                          <option key={num} value={num}>
                            {num}명
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="section-title with-action">
                  <span>
                    <User className="icon-sm" /> 인원별 주간 가능 시간
                  </span>
                  <button
                    onClick={() => setEditingHours(!editingHours)}
                    className="btn btn-blue btn-xs"
                  >
                    {editingHours ? '저장' : '수정'}
                  </button>
                </div>

                {/* ✅ 새 옵션: 평일 연속 강제 토글 */}
                <div className="option-row">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={enforceContiguity}
                      onChange={(e) => setEnforceContiguity(e.target.checked)}
                    />
                    <span>연속 강제 (평일)</span>
                  </label>
                  <div className="tiny muted">
                    켜짐: 4h는 붙여서, 6h는 4+휴게+2 또는 2+휴게+4
                    &nbsp;/&nbsp; 꺼짐: 패턴 제약 해제(평일 1일 6h 제한은 유지)
                  </div>
                </div>

                <div className="list-scroll">
                  {people.map((person) => (
                    <div key={person.name} className="person-row">
                      <div className="person-id">
                        <div className={`dot ${person.color}`}></div>
                        <span className="label-sm">{person.name}</span>
                      </div>
                      {editingHours ? (
                        <input
                          type="number"
                          value={person.totalHours}
                          onChange={(e) =>
                            updatePersonHours(person.name, e.target.value)
                          }
                          className="input input-sm"
                          min="0"
                          max="98"
                          step="2"
                        />
                      ) : (
                        <span className="label-strong">
                          {person.totalHours}시간
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="notice">
              <strong>자동 배치 조건:</strong> 기존 배치는 유지 / 자동 충원은 평일만 /
              평일: 1인당 하루 최대 6시간,&nbsp;
              <span className="emphasis-blue">
                연속 강제 토글에 따라 패턴 적용
              </span>
              &nbsp;/ 주말: 6시간 이상 연속 배치 가능(일일 제한 없음)
            </div>
          </div>
        )}

        <div className="grid-12 gap-4">
          {/* 스케줄 표 */}
          <div className="col-9">
            <div className="card">
              <div className="table-head">
                <h2 className="section-title">주간 스케줄표</h2>
                <div className="muted">셀을 클릭하거나 드래그하여 배치</div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="sticky-left time-col">시간</th>
                      {daysOfWeek.map((day) => (
                        <th key={day} className="th-day">
                          <div className="th-day-inner">
                            <span>{day}</span>
                            {weekdays.includes(day) && (
                              <span className="badge-auto">자동</span>
                            )}
                            <button
                              onClick={() => resetDaySchedule(day)}
                              className="icon-btn danger"
                              title={`${day} 초기화`}
                            >
                              <RotateCcw className="icon-xs" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {createTimeSlots().map((slot) => {
                      const currentRequired = requiredStaff[slot.id] || 0;
                      return (
                        <tr key={slot.id}>
                          <td className="sticky-left time-cell">
                            <div className="time-cell-inner">
                              <div className="time-range">
                                <Clock className="icon-xs muted" /> {slot.start} -{' '}
                                {slot.end}
                              </div>
                              <span className="badge-gray">
                                {currentRequired}명
                              </span>
                            </div>
                          </td>

                          {daysOfWeek.map((day) => {
                            const daySlot = weekSchedule[day].find(
                              (s) => s.id === slot.id
                            );
                            const cellId = `${day}-${slot.id}`;
                            const isHovered = hoveredCell === cellId;
                            const isSelected = selectedCell === cellId;
                            const isUnderStaffed =
                              daySlot.assigned.length < currentRequired;
                            const isOverStaffed =
                              daySlot.assigned.length > currentRequired;

                            return (
                              <td
                                key={cellId}
                                id={`cell-${cellId}`}
                                className={[
                                  'cell',
                                  isSelected ? 'cell-selected' : '',
                                  isHovered ? 'cell-hover' : '',
                                  isUnderStaffed ? 'cell-under' : '',
                                  isOverStaffed ? 'cell-over' : '',
                                  !isUnderStaffed &&
                                  !isOverStaffed &&
                                  daySlot.assigned.length > 0
                                    ? 'cell-ok'
                                    : '',
                                ].join(' ')}
                                onDragOver={handleDragOver}
                                onDragEnter={() =>
                                  handleDragEnter(day, slot.id)
                                }
                                onDrop={(e) => handleDrop(e, day, slot.id)}
                                onClick={(e) =>
                                  handleCellClick(e, day, slot.id)
                                }
                              >
                                <div className="assignees">
                                  {daySlot.assigned.length === 0 ? (
                                    <div className="assignees-empty">
                                      <button className="icon-btn muted">
                                        <UserPlus className="icon-sm" />
                                      </button>
                                    </div>
                                  ) : (
                                    daySlot.assigned.map((person, idx) => (
                                      <div
                                        key={`${cellId}-${person.name}-${idx}`}
                                        className={`chip ${person.color}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span>{person.name}</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removePerson(
                                              day,
                                              slot.id,
                                              person.name
                                            );
                                          }}
                                          className="chip-close"
                                        >
                                          <X className="icon-xxs" />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                                <div className="cell-count">
                                  <span
                                    className={[
                                      'count',
                                      isUnderStaffed
                                        ? 'count-warn'
                                        : isOverStaffed
                                        ? 'count-danger'
                                        : 'count-ok',
                                    ].join(' ')}
                                  >
                                    {daySlot.assigned.length}/{currentRequired}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 통계 표 */}
            <div className="card mt-16">
              <h3 className="section-title">주간 배치 현황</h3>
              <div className="table-scroll">
                <table className="table stats">
                  <thead>
                    <tr>
                      <th className="text-left">이름</th>
                      <th className="text-center">총 배치</th>
                      {daysOfWeek.map((day) => (
                        <th key={day} className="text-center">
                          {day.slice(0, 1)}
                        </th>
                      ))}
                      <th className="text-center">남은시간</th>
                      <th className="text-center">진행률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(stats).map((person) => {
                      const usageRate = (
                        ((person.totalHours - person.remainingHours) /
                          person.totalHours) *
                        100
                      ).toFixed(0);
                      return (
                        <tr key={person.name}>
                          <td>
                            <div className="person-id">
                              <div className={`dot ${person.color}`}></div>
                              <span className="label-strong">
                                {person.name}
                              </span>
                            </div>
                          </td>
                          <td className="text-center label-strong">
                            {person.totalAssigned}h
                          </td>
                          {daysOfWeek.map((day) => (
                            <td key={day} className="text-center small">
                              {person.dailyHours[day]
                                ? `${person.dailyHours[day]}h`
                                : '-'}
                            </td>
                          ))}
                          <td className="text-center">
                            <span
                              className={[
                                'label-strong',
                                person.remainingHours === 0
                                  ? 'text-red'
                                  : person.remainingHours <= 4
                                  ? 'text-yellow'
                                  : 'text-green',
                              ].join(' ')}
                            >
                              {person.remainingHours}h
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="progress">
                              <div
                                className={`progress-bar ${person.color}`}
                                style={{ width: `${usageRate}%` }}
                              />
                              <span className="progress-label">
                                {usageRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>합계</td>
                      <td className="text-center emphasis-blue">
                        {totalAssignedHours}h
                      </td>
                      {daysOfWeek.map((day) => {
                        const dayTotal = Object.values(stats).reduce(
                          (acc, person) => acc + (person.dailyHours[day] || 0),
                          0
                        );
                        return (
                          <td key={day} className="text-center small">
                            {dayTotal > 0 ? `${dayTotal}h` : '-'}
                          </td>
                        );
                      })}
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* 오른쪽 패널 */}
          <div className="col-3">
            <div className="card sticky">
              <h2 className="section-title">
                <User className="icon-sm" /> 배치 가능 인원
              </h2>
              <div className="people-scroll">
                {Object.entries(groupedPeople).map(
                  ([hours, peopleList]) =>
                    peopleList.length > 0 && (
                      <div key={hours} className="group">
                        <h3 className="group-title">{hours} 그룹</h3>
                        <div className="v-stack-8">
                          {peopleList.map((person) => (
                            <div
                              key={person.name}
                              draggable={person.remainingHours > 0}
                              onDragStart={() => setDraggedPerson(person)}
                              onDragEnd={() => {
                                setDraggedPerson(null);
                                setHoveredCell(null);
                              }}
                              className={[
                                'person-card',
                                person.remainingHours > 0
                                  ? 'drag-ok'
                                  : 'drag-no',
                              ].join(' ')}
                            >
                              <div className="person-card-head">
                                <div className="person-id">
                                  <div className={`dot ${person.color}`}></div>
                                  <span className="label-strong">
                                    {person.name}
                                  </span>
                                </div>
                                <div className="right">
                                  <div className="tiny muted">남은시간</div>
                                  <div
                                    className={[
                                      'label-strong',
                                      person.remainingHours === 0
                                        ? 'text-red'
                                        : person.remainingHours <= 4
                                        ? 'text-yellow'
                                        : 'text-green',
                                    ].join(' ')}
                                  >
                                    {person.remainingHours}h
                                  </div>
                                </div>
                              </div>
                              <div className="progress thin">
                                <div
                                  className={`progress-bar ${person.color}`}
                                  style={{
                                    width: `${
                                      (person.remainingHours /
                                        person.totalHours) *
                                      100
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 드롭다운 */}
        {showDropdown && selectedCell && (
          <div
            ref={dropdownRef}
            style={getDropdownPosition()}
            className="dropdown"
          >
            <div className="dropdown-head">인원 선택</div>
            {Object.entries(groupedPeople).map(
              ([hours, peopleList]) =>
                peopleList.length > 0 && (
                  <div key={hours} className="dropdown-group">
                    <div className="dropdown-group-title">{hours} 그룹</div>
                    {peopleList.map((person) => {
                      const isAlreadyAssigned =
                        selectedCell &&
                        (() => {
                          const [day, slotId] = selectedCell.split('-');
                          const slot = weekSchedule[day].find(
                            (s) => s.id === parseInt(slotId)
                          );
                          return slot.assigned.some(
                            (p) => p.name === person.name
                          );
                        })();

                      return (
                        <button
                          key={person.name}
                          onClick={() => handlePersonSelect(person)}
                          disabled={
                            person.remainingHours < 2 || isAlreadyAssigned
                          }
                          className={[
                            'dropdown-item',
                            person.remainingHours < 2 || isAlreadyAssigned
                              ? 'disabled'
                              : '',
                          ].join(' ')}
                        >
                          <div className="person-id">
                            <div className={`dot ${person.color}`}></div>
                            <span className="label-sm">{person.name}</span>
                          </div>
                          <div className="right">
                            {isAlreadyAssigned && (
                              <span className="pill pill-orange">배치됨</span>
                            )}
                            <span
                              className={[
                                'label-strong',
                                person.remainingHours === 0
                                  ? 'text-red'
                                  : person.remainingHours <= 4
                                  ? 'text-yellow'
                                  : 'text-green',
                              ].join(' ')}
                            >
                              {person.remainingHours}h
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleSystem;
