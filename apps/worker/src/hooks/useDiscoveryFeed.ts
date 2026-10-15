import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Job,
  DiscoveryFeedFilters,
  fetchDiscoveryFeed,
  applyForJobSafe,
  recordSwipePass,
  undoSwipePass,
} from '@opskil/shared';
import { GeoLocation, MUMBAI_ZONES } from '../utils/location';

export interface FailedApplicationState {
  job: Job;
  errorCode?: string;
  errorMessage: string;
}

export function useDiscoveryFeed(workerId: string | null, verificationStatus?: string) {
  const [cards, setCards] = useState<Job[]>([]);
  const [passedHistory, setPassedHistory] = useState<Job[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<DiscoveryFeedFilters>({
    category: 'all',
    zone: 'All Zones',
  });
  const [workerLocation, setWorkerLocation] = useState<GeoLocation | null>(
    MUMBAI_ZONES[0].coords // Default to BKC center
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Failure recovery state
  const [failedApplication, setFailedApplication] = useState<FailedApplicationState | null>(null);
  const [inFlightApplication, setInFlightApplication] = useState<Job | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const appliedJobIdsRef = useRef<Set<string>>(appliedJobIds);
  useEffect(() => {
    appliedJobIdsRef.current = appliedJobIds;
  }, [appliedJobIds]);

  const loadFeed = useCallback(
    async (isPullToRefresh = false) => {
      if (isPullToRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetchDiscoveryFeed({
          workerId: workerId ?? undefined,
          filters,
          page: 1,
          pageSize: 30,
        });

        if (!isMounted.current) return;

        // If backend query encountered an error or RLS rejection, surface error state immediately — do NOT mask with demo fixtures
        if (result.error) {
          setError(result.error);
          setCards([]);
          return;
        }

        let activeJobs = result.jobs;

        // Filter out any already applied job IDs in session
        activeJobs = activeJobs.filter((j) => !appliedJobIdsRef.current.has(j.id));

        setCards(activeJobs);
      } catch (err: any) {
        if (!isMounted.current) return;
        setError(err.message || 'Failed to load shifts feed');
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [workerId, filters]
  );

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  /**
   * Swipe Right / Apply Handler with Optimistic UI & Safety Rollback Guarantee
   */
  const handleApply = useCallback(
    async (job: Job) => {
      if (!job) return;

      // Never substitute a fake 'demo-worker-id' when unauthenticated
      if (!workerId) {
        setFailedApplication({
          job,
          errorCode: 'AUTH_REQUIRED',
          errorMessage: 'Sign-in required: Please sign in with an active worker account before applying for shifts.',
        });
        return;
      }

      // Enforce KYC verification gate
      if (verificationStatus !== 'verified') {
        setFailedApplication({
          job,
          errorCode: 'KYC_REQUIRED',
          errorMessage: verificationStatus === 'pending'
            ? 'KYC Verification Pending: Your documents are currently under review by Admin. Applications will unlock as soon as your KYC is approved.'
            : 'KYC Required: Please submit your Aadhaar/PAN verification documents under Profile to apply for shifts.',
        });
        return;
      }

      // 1. Optimistic removal from deck
      setCards((prev) => prev.filter((c) => c.id !== job.id));
      setInFlightApplication(job);

      // 2. Execute safe server-side application
      const result = await applyForJobSafe(job.id, workerId);

      setInFlightApplication(null);

      if (result.success) {
        // Success: mark as applied
        setAppliedJobIds((prev) => new Set(prev).add(job.id));
      } else {
        // "A successful swipe animation must not be mistaken for a successful backend submission.
        // If the request fails, restore the card or let the user retry safely."
        setFailedApplication({
          job,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage || 'Server rejected application',
        });
      }
    },
    [workerId, verificationStatus]
  );

  /**
   * Swipe Left / Pass Handler with Undo Tracking
   */
  const handlePass = useCallback(
    async (job: Job) => {
      if (!job) return;

      // 1. Optimistic removal from deck & push to undo stack
      setCards((prev) => prev.filter((c) => c.id !== job.id));
      setPassedHistory((prev) => [job, ...prev]);

      // 2. Record pass event in background if authenticated
      if (workerId) {
        await recordSwipePass(job.id, workerId);
      }
    },
    [workerId]
  );

  /**
   * Undo Last Passed Shift
   */
  const handleUndoLastPass = useCallback(async () => {
    if (passedHistory.length === 0) return;

    const [lastPassed, ...rest] = passedHistory;
    setPassedHistory(rest);

    // Restore to top of cards deck
    setCards((prev) => [lastPassed, ...prev]);

    // Delete left swipe event in backend
    if (workerId) {
      await undoSwipePass(lastPassed.id, workerId);
    }
  }, [passedHistory, workerId]);

  /**
   * Failure Recovery Action: Restore Card to Deck
   */
  const handleRestoreFailedCard = useCallback(() => {
    if (!failedApplication) return;
    const { job } = failedApplication;
    setCards((prev) => [job, ...prev]);
    setFailedApplication(null);
  }, [failedApplication]);

  /**
   * Failure Recovery Action: Retry Backend Application
   */
  const handleRetryFailedApplication = useCallback(async () => {
    if (!failedApplication) return;
    const { job } = failedApplication;
    setFailedApplication(null);
    await handleApply(job);
  }, [failedApplication, handleApply]);

  return {
    cards,
    currentCard: cards[0] || null,
    nextCard: cards[1] || null,
    passedHistory,
    appliedJobIds,
    loading,
    refreshing,
    error,
    filters,
    workerLocation,
    failedApplication,
    inFlightApplication,
    setFilters,
    setWorkerLocation,
    onApply: handleApply,
    onPass: handlePass,
    onUndo: handleUndoLastPass,
    onRestoreFailedCard: handleRestoreFailedCard,
    onRetryFailedApplication: handleRetryFailedApplication,
    onRefresh: () => loadFeed(true),
  };
}
