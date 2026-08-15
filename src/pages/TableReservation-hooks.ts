import { useState, useEffect, useCallback } from 'react';
import { useReservationStore } from '@/hooks/stores/use-reservation-store';
import { TIME_SLOTS, getNextSaturday } from './TableReservation-constants';

export function useReservationTable() {
  const [zone, setZone] = useState('rooftop');
  const [selectedTime, setSelectedTime] = useState('19:00');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [date, setDate] = useState(getNextSaturday);
  const [guests, setGuests] = useState(2);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState<Record<string, string>>({});

  const { availableSlots, tables, loading, fetchSlots, createReservation } = useReservationStore();

  useEffect(() => {
    fetchSlots(date, selectedTime);
  }, [date, selectedTime, fetchSlots]);

  const displaySlots = availableSlots.length > 0
    ? availableSlots
    : TIME_SLOTS.map((slot) => ({ time: slot.time, available: true }));

  const handleTableSelect = (tableId: string) => {
    setSelectedTable((prev) => (prev === tableId ? null : tableId));
  };

  const handleConfirm = useCallback(() => {
    if (!selectedTable || !date || !selectedTime) return;
    setShowIdentityModal(true);
  }, [selectedTable, date, selectedTime]);

  return {
    zone, setZone,
    selectedTime, setSelectedTime,
    selectedTable, setSelectedTable,
    date, setDate,
    guests, setGuests,
    showIdentityModal, setShowIdentityModal,
    showSuccessModal, setShowSuccessModal,
    successDetails, setSuccessDetails,
    tables, loading,
    displaySlots,
    handleTableSelect,
    handleConfirm,
    createReservation,
  };
}
