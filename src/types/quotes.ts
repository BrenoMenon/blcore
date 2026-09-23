export interface QuoteItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CategoryField {
  key: string;
  label: string;
  value: string;
}

export interface QuoteClient {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  address?: string;
}

export interface CompanyBranding {
  companyName: string;
  category: string;
  cnpj?: string;
  email?: string;
  logoUrl?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface QuoteData {
  id: string;
  number: string;
  createdAt: string;
  title: string;
  category: string;
  client: QuoteClient;
  categorySpecificFields: CategoryField[];
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentTerms: string;
  validityDays?: number | null;
  notes: string;
  branding: CompanyBranding;
}
