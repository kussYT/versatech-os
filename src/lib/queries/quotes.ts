import "server-only";

import type { QuoteStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type QuoteListItem = {
  id: string;
  reference: string;
  status: QuoteStatus;
  amountIncTax: string;
  createdAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  relevantAt: string;
  company: {
    id: string;
    name: string;
  };
  opportunity: {
    id: string;
    title: string;
  };
};

export type CompanyQuoteItem = {
  id: string;
  reference: string;
  status: QuoteStatus;
  amountIncTax: string;
};

function relevantAt(quote: {
  createdAt: Date;
  sentAt: Date | null;
  acceptedAt: Date | null;
}) {
  return (quote.acceptedAt ?? quote.sentAt ?? quote.createdAt).toISOString();
}

export async function listQuotes(): Promise<QuoteListItem[]> {
  const quotes = await prisma.quote.findMany({
    orderBy: [{ createdAt: "desc" }, { reference: "asc" }],
    include: {
      company: { select: { id: true, name: true } },
      opportunity: { select: { id: true, title: true } },
    },
  });

  return quotes.map((quote) => ({
    id: quote.id,
    reference: quote.reference,
    status: quote.status,
    amountIncTax: quote.amountIncTax.toString(),
    createdAt: quote.createdAt.toISOString(),
    sentAt: quote.sentAt?.toISOString() ?? null,
    acceptedAt: quote.acceptedAt?.toISOString() ?? null,
    relevantAt: relevantAt(quote),
    company: quote.company,
    opportunity: quote.opportunity,
  }));
}

export async function getSignedRevenue() {
  const result = await prisma.quote.aggregate({
    where: { status: "ACCEPTED" },
    _sum: { amountIncTax: true },
  });

  return result._sum.amountIncTax?.toString() ?? "0";
}
