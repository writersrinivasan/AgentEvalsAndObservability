// ShopSmart — a fictional e-commerce company. This is the "real world" the
// support agent operates in: an orders database and a knowledge base.

// Fixed "today" so refund-window math (and therefore every eval) is deterministic.
export const REFERENCE_DATE = "2026-10-15";

export type OrderStatus = "processing" | "in_transit" | "delivered";

export interface Order {
  id: string;
  customer: string;
  item: string;
  category: "electronics" | "apparel" | "home" | "gift_card";
  amount: number;
  status: OrderStatus;
  orderedAt: string;
  deliveredAt?: string;
  eta?: string;
  finalSale?: boolean;
}

export const ORDERS: Record<string, Order> = {
  "ORD-1001": {
    id: "ORD-1001",
    customer: "Priya",
    item: "AuraSound Wireless Headphones",
    category: "electronics",
    amount: 129,
    status: "delivered",
    orderedAt: "2026-09-30",
    deliveredAt: "2026-10-05",
  },
  "ORD-1002": {
    id: "ORD-1002",
    customer: "Arjun",
    item: "SprintPro Running Shoes",
    category: "apparel",
    amount: 89,
    status: "delivered",
    orderedAt: "2026-08-25",
    deliveredAt: "2026-08-31",
  },
  "ORD-1003": {
    id: "ORD-1003",
    customer: "Meera",
    item: "NovaBook Pro 14 Laptop",
    category: "electronics",
    amount: 1299,
    status: "delivered",
    orderedAt: "2026-10-06",
    deliveredAt: "2026-10-10",
  },
  "ORD-1004": {
    id: "ORD-1004",
    customer: "Karthik",
    item: "ShopSmart Gift Card",
    category: "gift_card",
    amount: 50,
    status: "delivered",
    orderedAt: "2026-10-08",
    deliveredAt: "2026-10-08",
    finalSale: true,
  },
  "ORD-1005": {
    id: "ORD-1005",
    customer: "Divya",
    item: "BrewMaster Coffee Maker",
    category: "home",
    amount: 79,
    status: "in_transit",
    orderedAt: "2026-10-11",
    eta: "2026-10-18",
  },
  "ORD-1006": {
    id: "ORD-1006",
    customer: "Rahul",
    item: "Lumen Desk Lamp",
    category: "home",
    amount: 35,
    status: "processing",
    orderedAt: "2026-10-14",
    eta: "2026-10-21",
  },
  "ORD-1007": {
    id: "ORD-1007",
    customer: "Anjali",
    item: "PulseFit Smart Watch",
    category: "electronics",
    amount: 249,
    status: "delivered",
    orderedAt: "2026-10-09",
    deliveredAt: "2026-10-13",
  },
};

export interface KbDoc {
  id: string;
  title: string;
  keywords: string[];
  text: string;
}

export const KNOWLEDGE_BASE: KbDoc[] = [
  {
    id: "kb-refund",
    title: "Refund policy",
    keywords: ["refund", "return", "money back", "policy", "exchange"],
    text: "Items can be refunded within 30 days of delivery. Gift cards and items marked final sale are not refundable. Refunds above $500 require review by a human specialist. Approved refunds reach the original payment method in 5-7 business days.",
  },
  {
    id: "kb-shipping",
    title: "Shipping policy",
    keywords: ["shipping", "delivery", "ship", "international", "countries", "track"],
    text: "Standard shipping takes 3-5 business days within India. We ship internationally to 42 countries; international orders take 7-14 business days. Every order gets a tracking link by email once it leaves the warehouse.",
  },
  {
    id: "kb-headphones",
    title: "AuraSound Wireless Headphones — specs",
    keywords: ["headphones", "aurasound", "battery", "noise", "bluetooth"],
    text: "AuraSound Wireless Headphones offer 30 hours of battery life, active noise cancellation, Bluetooth 5.3, and a 10-minute quick charge that gives 5 hours of playback.",
  },
  {
    id: "kb-watch",
    title: "PulseFit Smart Watch — specs",
    keywords: ["watch", "pulsefit", "water", "swim", "waterproof", "fitness"],
    text: "PulseFit Smart Watch is water resistant to 50 metres (5 ATM), safe for swimming. Battery lasts 7 days. Tracks heart rate, SpO2 and sleep.",
  },
  {
    id: "kb-warranty",
    title: "Warranty",
    keywords: ["warranty", "repair", "broken", "defect", "guarantee"],
    text: "All electronics carry a 1-year manufacturer warranty covering defects. Physical or water damage beyond the rated limits is not covered.",
  },
  {
    id: "kb-payments",
    title: "Payment methods",
    keywords: ["payment", "pay", "upi", "card", "emi", "cod", "cash"],
    text: "We accept UPI, all major credit and debit cards, net banking, no-cost EMI on orders above $200, and cash on delivery for orders under $100.",
  },
];

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}
