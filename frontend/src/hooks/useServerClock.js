import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useQuery,
} from "@tanstack/react-query";

import {
  queryKeys,
} from "../constants/queryKeys";
import {
  adminService,
} from "../services/adminService";

export function useServerClock() {
  const [now, setNow] = useState(() =>
    Date.now(),
  );

  const serverTimeQuery = useQuery({
    queryKey: queryKeys.serverTime,
    queryFn: adminService.getServerTime,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const serverDatetime =
    serverTimeQuery.data?.datetime;
  const serverDataUpdatedAt =
    serverTimeQuery.dataUpdatedAt;

  useEffect(() => {
    if (!serverDatetime) {
      return undefined;
    }

    const intervalId = window.setInterval(
      () => {
        setNow(Date.now());
      },
      1000,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [serverDatetime]);

  const currentTime = useMemo(() => {
    if (!serverDatetime) {
      return null;
    }

    const serverTime = new Date(
      serverDatetime,
    );
    const synchronizedAt =
      serverDataUpdatedAt || now;
    const elapsedMilliseconds =
      now - synchronizedAt;

    return new Date(
      serverTime.getTime() +
        Math.max(elapsedMilliseconds, 0),
    );
  }, [
    now,
    serverDatetime,
    serverDataUpdatedAt,
  ]);

  return useMemo(
    () => ({
      currentTime,
      timezone:
        serverTimeQuery.data?.timezone,
      isLoading: serverTimeQuery.isLoading,
      isError: serverTimeQuery.isError,
    }),
    [
      currentTime,
      serverTimeQuery.data?.timezone,
      serverTimeQuery.isLoading,
      serverTimeQuery.isError,
    ],
  );
}
