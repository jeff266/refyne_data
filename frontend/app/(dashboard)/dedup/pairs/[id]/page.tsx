'use client';

import { PairReview } from '@/components/dedup';

export default function PairReviewPage({ params }: { params: { id: string } }) {
  return <PairReview pairId={params.id} />;
}
