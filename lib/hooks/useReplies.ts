import useSWRInfinite from "swr/infinite";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useReplies(contributionId: string, pageSize = 20) {
  const getKey = (index: number, prev: any) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = index === 0 ? "" : `&cursor=${prev.nextCursor}`;
    return `/api/contributions/${contributionId}/replies?take=${pageSize}${cursor}`;
  };

  const { data, error, size, setSize, mutate, isValidating } = useSWRInfinite(getKey, fetcher);
  const items = data ? data.flatMap((d: any) => d.items) : [];
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  return { items, error, size, setSize, hasMore, mutate, isLoading: !data && !error, isValidating };
}
