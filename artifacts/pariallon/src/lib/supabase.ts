import { createClient } from '@supabase/supabase-js';

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price_naira: number;
  image_url: string;
  stock_quantity: number;
  is_featured: boolean;
  created_at: string;
};

export type CartItem = {
  product_id: string;
  quantity: number;
};

export type OrderItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price_naira: number;
  image_url: string;
  subtotal_naira: number;
};

export type Order = {
  id: string;
  user_id: string;
  email: string;
  customer_name: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
  items: OrderItem[];
  subtotal_naira: number;
  shipping_naira: number;
  total_naira: number;
  status: string;
  created_at: string;
};

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      products: TableDefinition<
        Product,
        Omit<Product, 'id' | 'created_at'> &
          Partial<Pick<Product, 'id' | 'created_at'>>,
        Partial<Product>
      >;
      carts: TableDefinition<
        {
          user_id: string;
          items: CartItem[];
          updated_at: string;
        },
        {
          user_id: string;
          items: CartItem[];
          updated_at?: string;
        },
        {
          items?: CartItem[];
          updated_at?: string;
        }
      >;
      orders: TableDefinition<
        Order,
        Omit<Order, 'id' | 'created_at'> & Partial<Pick<Order, 'id' | 'created_at'>>,
        Partial<Order>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      place_order: {
        Args: {
          p_customer_name: string;
          p_email: string;
          p_phone: string;
          p_address_line1: string;
          p_city: string;
          p_state: string;
          p_items: CartItem[];
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Pariallon needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect to Supabase.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);