'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BookkeepingNodeAssignment, HomeOfficeEntry, MileageEntry } from '@/lib/types';
import {
  getBooksSummary,
  getHomeOffice,
  getManualEntries,
  getMileageEntries,
  saveHomeOffice,
  saveManualEntries,
  saveMileageEntries,
  type BooksSummary,
} from '@/lib/files-api';
import { BOOK_QUARTERS, createQuarterSummaryRecord, type QuarterNumber } from '@/lib/books-view';

interface UseBooksDataResult {
  quarterSummaries: Record<QuarterNumber, BooksSummary>;
  loading: boolean;
  error: string | null;
  allMileage: MileageEntry[];
  homeOffice: HomeOfficeEntry | null;
  allManualEntries: BookkeepingNodeAssignment[];
  handleAddMileage: (entry: MileageEntry) => Promise<void>;
  handleDeleteMileage: (id: string) => Promise<void>;
  handleSaveHomeOffice: (entry: HomeOfficeEntry) => Promise<void>;
  handleAddManualEntry: (entry: BookkeepingNodeAssignment) => Promise<void>;
  handleDeleteManualEntry: (index: number) => Promise<void>;
}

export function useBooksData(userId: string, year: string): UseBooksDataResult {
  const [quarterSummaries, setQuarterSummaries] = useState<Record<QuarterNumber, BooksSummary>>(
    () => createQuarterSummaryRecord(year),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allMileage, setAllMileage] = useState<MileageEntry[]>([]);
  const [homeOffice, setHomeOffice] = useState<HomeOfficeEntry | null>(null);
  const [allManualEntries, setAllManualEntries] = useState<BookkeepingNodeAssignment[]>([]);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQuarterSummaries(createQuarterSummaryRecord(year));
    try {
      const results = await Promise.all(
        BOOK_QUARTERS.map(async (quarter) => {
          const summary = await getBooksSummary(userId, quarter, year);
          return [quarter, summary] as const;
        }),
      );
      const next = createQuarterSummaryRecord(year);
      results.forEach(([quarter, summary]) => {
        next[quarter] = summary;
      });
      setQuarterSummaries(next);
    } catch (err) {
      console.error('[books] Failed to load summary:', err);
      setError('Failed to load bookkeeping data');
    } finally {
      setLoading(false);
    }
  }, [userId, year]);

  const loadPersistedData = useCallback(async () => {
    try {
      const [mileage, savedHomeOffice, manualEntries] = await Promise.all([
        getMileageEntries(userId),
        getHomeOffice(userId),
        getManualEntries(userId),
      ]);
      setAllMileage(mileage);
      setHomeOffice(savedHomeOffice);
      setAllManualEntries(manualEntries);
    } catch (err) {
      console.error('[books] Failed to load persisted data:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadPersistedData();
  }, [loadPersistedData]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  const handleAddMileage = useCallback(async (entry: MileageEntry) => {
    const next = [...allMileage, entry];
    setAllMileage(next);
    await saveMileageEntries(userId, next);
    await loadSummaries();
  }, [allMileage, loadSummaries, userId]);

  const handleDeleteMileage = useCallback(async (id: string) => {
    const next = allMileage.filter((entry) => entry.id !== id);
    setAllMileage(next);
    await saveMileageEntries(userId, next);
    await loadSummaries();
  }, [allMileage, loadSummaries, userId]);

  const handleSaveHomeOffice = useCallback(async (entry: HomeOfficeEntry) => {
    setHomeOffice(entry);
    await saveHomeOffice(userId, entry);
    await loadSummaries();
  }, [loadSummaries, userId]);

  const handleAddManualEntry = useCallback(async (entry: BookkeepingNodeAssignment) => {
    const next = [...allManualEntries, entry];
    setAllManualEntries(next);
    await saveManualEntries(userId, next);
    await loadSummaries();
  }, [allManualEntries, loadSummaries, userId]);

  const handleDeleteManualEntry = useCallback(async (index: number) => {
    const next = allManualEntries.filter((_, itemIndex) => itemIndex !== index);
    setAllManualEntries(next);
    await saveManualEntries(userId, next);
    await loadSummaries();
  }, [allManualEntries, loadSummaries, userId]);

  return {
    quarterSummaries,
    loading,
    error,
    allMileage,
    homeOffice,
    allManualEntries,
    handleAddMileage,
    handleDeleteMileage,
    handleSaveHomeOffice,
    handleAddManualEntry,
    handleDeleteManualEntry,
  };
}
