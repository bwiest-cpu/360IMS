-- =====================================================================
-- 360IMS — Initial Schema Migration
-- 360 Metal Roofing Supply, Austin, TX
-- =====================================================================

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =====================================================================
-- TABLE: locations
-- =====================================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  state text,
  zip text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.locations (name, city, state, is_active)
values ('360MRS Austin', 'Austin', 'TX', true)
on conflict do nothing;

-- =====================================================================
-- TABLE: users (extends auth.users)
-- =====================================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin','manager','salesperson','viewer')),
  is_active boolean not null default true,
  commission_rate numeric(5,4) not null default 0.1000,
  permissions jsonb,
  must_change_password boolean not null default false,
  phone text,
  created_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users(role);
create index if not exists users_is_active_idx on public.users(is_active);

-- =====================================================================
-- TABLE: customers
-- =====================================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  contact_name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  assigned_salesperson_id uuid references public.users(id),
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists customers_company_idx on public.customers(company_name);
create index if not exists customers_contact_idx on public.customers(contact_name);
create index if not exists customers_salesperson_idx on public.customers(assigned_salesperson_id);

-- =====================================================================
-- TABLE: suppliers
-- =====================================================================
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists suppliers_company_idx on public.suppliers(company_name);

-- =====================================================================
-- TABLE: products
-- =====================================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  category text,
  unit_of_measure text not null check (unit_of_measure in
    ('coil','bundle','sheet','box','bag','each','lf','square')),
  default_sales_price numeric(12,4) not null default 0,
  default_cost numeric(12,4) not null default 0,
  current_stock_quantity numeric(12,4) not null default 0,
  reorder_point numeric(12,4) not null default 0,
  location_id uuid references public.locations(id),
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists products_sku_idx on public.products(sku);
create index if not exists products_name_idx on public.products(name);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_active_idx on public.products(is_active);

-- =====================================================================
-- TABLE: purchase_orders
-- =====================================================================
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references public.suppliers(id),
  status text not null default 'draft'
    check (status in ('draft','sent','partially_received','received','cancelled')),
  order_date date not null default current_date,
  expected_date date,
  received_date date,
  subtotal numeric(12,2) not null default 0,
  freight_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists po_supplier_idx on public.purchase_orders(supplier_id);
create index if not exists po_status_idx on public.purchase_orders(status);
create index if not exists po_order_date_idx on public.purchase_orders(order_date);

-- =====================================================================
-- TABLE: purchase_order_items
-- =====================================================================
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity_ordered numeric(12,4) not null,
  quantity_received numeric(12,4) not null default 0,
  unit_cost numeric(12,4) not null,
  line_total numeric(12,2) generated always as ((quantity_ordered * unit_cost)::numeric(12,2)) stored,
  created_at timestamptz not null default now()
);

create index if not exists poi_po_idx on public.purchase_order_items(purchase_order_id);
create index if not exists poi_product_idx on public.purchase_order_items(product_id);

-- =====================================================================
-- TABLE: inventory_lots (FIFO)
-- =====================================================================
create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  purchase_order_id uuid references public.purchase_orders(id),
  quantity_received numeric(12,4) not null,
  quantity_remaining numeric(12,4) not null,
  unit_cost numeric(12,4) not null,
  received_date date not null,
  location_id uuid references public.locations(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists lots_product_idx on public.inventory_lots(product_id);
create index if not exists lots_received_date_idx on public.inventory_lots(received_date);
create index if not exists lots_product_date_idx on public.inventory_lots(product_id, received_date, created_at);
create index if not exists lots_remaining_idx on public.inventory_lots(quantity_remaining);

-- =====================================================================
-- TABLE: sales_orders (forward declare for sales_quotes ref)
-- =====================================================================
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  so_number text not null unique,
  customer_id uuid not null references public.customers(id),
  salesperson_id uuid not null references public.users(id),
  status text not null default 'draft'
    check (status in ('draft','confirmed','invoiced','fulfilled','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','partial','paid')),
  order_date date not null default current_date,
  invoice_date date,
  fulfilled_date date,
  payment_date date,
  subtotal numeric(12,2) not null default 0,
  freight_charge numeric(12,2) not null default 0,
  sales_tax_rate numeric(5,4) not null default 0.0825,
  sales_tax_amount numeric(12,2) not null default 0,
  credit_card_fee_rate numeric(5,4) not null default 0,
  credit_card_fee_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  internal_notes text,
  converted_from_quote_id uuid,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists so_customer_idx on public.sales_orders(customer_id);
create index if not exists so_salesperson_idx on public.sales_orders(salesperson_id);
create index if not exists so_status_idx on public.sales_orders(status);
create index if not exists so_payment_status_idx on public.sales_orders(payment_status);
create index if not exists so_order_date_idx on public.sales_orders(order_date);
create index if not exists so_invoice_date_idx on public.sales_orders(invoice_date);
create index if not exists so_payment_date_idx on public.sales_orders(payment_date);

-- =====================================================================
-- TABLE: sales_quotes
-- =====================================================================
create table if not exists public.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  customer_id uuid not null references public.customers(id),
  salesperson_id uuid not null references public.users(id),
  status text not null default 'draft'
    check (status in ('draft','sent','accepted','declined','converted','expired')),
  quote_date date not null default current_date,
  expiry_date date,
  subtotal numeric(12,2) not null default 0,
  freight_charge numeric(12,2) not null default 0,
  sales_tax_rate numeric(5,4) not null default 0.0825,
  sales_tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  internal_notes text,
  converted_to_so_id uuid references public.sales_orders(id),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists quote_customer_idx on public.sales_quotes(customer_id);
create index if not exists quote_salesperson_idx on public.sales_quotes(salesperson_id);
create index if not exists quote_status_idx on public.sales_quotes(status);
create index if not exists quote_date_idx on public.sales_quotes(quote_date);

alter table public.sales_orders
  add constraint sales_orders_converted_from_quote_fk
  foreign key (converted_from_quote_id) references public.sales_quotes(id);

-- =====================================================================
-- TABLE: sales_quote_items
-- =====================================================================
create table if not exists public.sales_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sales_quotes(id) on delete cascade,
  product_id uuid references public.products(id),
  custom_description text,
  quantity numeric(12,4) not null,
  unit_of_measure text not null,
  unit_price numeric(12,4) not null,
  fifo_cost_snapshot numeric(12,4) not null default 0,
  line_total numeric(12,2) generated always as ((quantity * unit_price)::numeric(12,2)) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sqi_quote_idx on public.sales_quote_items(quote_id);
create index if not exists sqi_product_idx on public.sales_quote_items(product_id);

-- =====================================================================
-- TABLE: sales_order_items
-- =====================================================================
create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  custom_description text,
  quantity numeric(12,4) not null,
  unit_of_measure text not null,
  unit_price numeric(12,4) not null,
  fifo_cost numeric(12,4) not null default 0,
  line_total numeric(12,2) generated always as ((quantity * unit_price)::numeric(12,2)) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists soi_so_idx on public.sales_order_items(sales_order_id);
create index if not exists soi_product_idx on public.sales_order_items(product_id);

-- =====================================================================
-- TABLE: commission_records
-- =====================================================================
create table if not exists public.commission_records (
  id uuid primary key default gen_random_uuid(),
  salesperson_id uuid not null references public.users(id),
  sales_order_id uuid not null references public.sales_orders(id) unique,
  invoice_date date not null,
  payment_date date,
  gross_revenue numeric(12,2) not null,
  freight_charge numeric(12,2) not null default 0,
  sales_tax_amount numeric(12,2) not null default 0,
  credit_card_fee_amount numeric(12,2) not null default 0,
  cogs numeric(12,2) not null,
  net_profit numeric(12,2) not null,
  commission_rate numeric(5,4) not null default 0.1000,
  commission_amount numeric(12,2) not null,
  commission_period text not null,
  is_paid boolean not null default false,
  paid_date date,
  created_at timestamptz not null default now()
);

create index if not exists commission_salesperson_idx on public.commission_records(salesperson_id);
create index if not exists commission_period_idx on public.commission_records(commission_period);
create index if not exists commission_is_paid_idx on public.commission_records(is_paid);

-- =====================================================================
-- TABLE: email_logs
-- =====================================================================
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('quote','sales_order','purchase_order')),
  document_id uuid not null,
  sent_by uuid references public.users(id),
  sent_to text not null,
  subject text not null,
  resend_message_id text,
  status text not null default 'sent' check (status in ('sent','failed')),
  error_message text,
  sent_at timestamptz not null default now()
);

create index if not exists email_logs_doc_idx on public.email_logs(document_type, document_id);
create index if not exists email_logs_sent_at_idx on public.email_logs(sent_at);

-- =====================================================================
-- TABLE: stock_adjustments
-- =====================================================================
create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  quantity_delta numeric(12,4) not null,
  reason text not null check (reason in ('correction','damage','shrinkage','opening_balance','other')),
  unit_cost numeric(12,4),
  notes text,
  lot_id uuid references public.inventory_lots(id),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists stock_adj_product_idx on public.stock_adjustments(product_id);
create index if not exists stock_adj_created_at_idx on public.stock_adjustments(created_at);

-- =====================================================================
-- TABLE: activity_log
-- =====================================================================
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_user_idx on public.activity_log(user_id);
create index if not exists activity_created_idx on public.activity_log(created_at);

-- =====================================================================
-- TABLE: company_settings
-- =====================================================================
create table if not exists public.company_settings (
  id integer primary key default 1 check (id = 1),
  company_name text not null default '360 Metal Roofing Supply',
  address text,
  city text,
  state text,
  zip text,
  phone text,
  email text default 'orders@360metalroofingsupply.com',
  logo_url text,
  default_tax_rate numeric(5,4) not null default 0.0825,
  default_credit_card_fee_rate numeric(5,4) not null default 0.0000,
  default_commission_rate numeric(5,4) not null default 0.1000,
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id, company_name, city, state, phone)
values (1, '360 Metal Roofing Supply', 'Austin', 'TX', '')
on conflict (id) do nothing;

-- =====================================================================
-- SEQUENCES for document numbering (year-scoped)
-- =====================================================================
create table if not exists public.document_sequences (
  doc_type text not null,
  year integer not null,
  last_value integer not null default 0,
  primary key (doc_type, year)
);

create or replace function public.next_document_number(p_doc_type text, p_prefix text)
returns text
language plpgsql
as $$
declare
  v_year int := extract(year from current_date)::int;
  v_next int;
begin
  insert into public.document_sequences (doc_type, year, last_value)
  values (p_doc_type, v_year, 1)
  on conflict (doc_type, year)
  do update set last_value = public.document_sequences.last_value + 1
  returning last_value into v_next;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.set_quote_number()
returns trigger language plpgsql as $$
begin
  if new.quote_number is null or new.quote_number = '' then
    new.quote_number := public.next_document_number('quote', 'QT');
  end if;
  return new;
end;
$$;

create or replace function public.set_so_number()
returns trigger language plpgsql as $$
begin
  if new.so_number is null or new.so_number = '' then
    new.so_number := public.next_document_number('sales_order', 'SO');
  end if;
  return new;
end;
$$;

create or replace function public.set_po_number()
returns trigger language plpgsql as $$
begin
  if new.po_number is null or new.po_number = '' then
    new.po_number := public.next_document_number('purchase_order', 'PO');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_quote_number on public.sales_quotes;
create trigger trg_set_quote_number
  before insert on public.sales_quotes
  for each row execute function public.set_quote_number();

drop trigger if exists trg_set_so_number on public.sales_orders;
create trigger trg_set_so_number
  before insert on public.sales_orders
  for each row execute function public.set_so_number();

drop trigger if exists trg_set_po_number on public.purchase_orders;
create trigger trg_set_po_number
  before insert on public.purchase_orders
  for each row execute function public.set_po_number();

-- =====================================================================
-- FIFO FUNCTIONS
-- =====================================================================
create or replace function public.fifo_fulfill_sales_order(p_sales_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_item record;
  v_lot record;
  v_remaining numeric(12,4);
  v_take numeric(12,4);
  v_cost_total numeric(14,4);
  v_qty_total numeric(14,4);
  v_avg_cost numeric(12,4);
  v_so_status text;
begin
  -- Guard: only fulfill once
  select status into v_so_status from public.sales_orders where id = p_sales_order_id for update;
  if v_so_status is null then
    raise exception 'Sales order % not found', p_sales_order_id;
  end if;
  if v_so_status = 'fulfilled' then
    raise exception 'Sales order already fulfilled';
  end if;

  for v_item in
    select * from public.sales_order_items
    where sales_order_id = p_sales_order_id
    order by sort_order, created_at
  loop
    if v_item.product_id is null then
      continue;
    end if;

    v_remaining := v_item.quantity;
    v_cost_total := 0;
    v_qty_total := 0;

    for v_lot in
      select * from public.inventory_lots
      where product_id = v_item.product_id
        and quantity_remaining > 0
      order by received_date asc, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_lot.quantity_remaining);

      update public.inventory_lots
      set quantity_remaining = quantity_remaining - v_take
      where id = v_lot.id;

      v_cost_total := v_cost_total + (v_take * v_lot.unit_cost);
      v_qty_total := v_qty_total + v_take;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_qty_total > 0 then
      v_avg_cost := (v_cost_total / v_qty_total)::numeric(12,4);
    else
      v_avg_cost := 0;
    end if;

    update public.sales_order_items
    set fifo_cost = v_avg_cost
    where id = v_item.id;

    update public.products
    set current_stock_quantity = greatest(current_stock_quantity - v_item.quantity, 0)
    where id = v_item.product_id;
  end loop;

  update public.sales_orders
  set status = 'fulfilled',
      fulfilled_date = current_date
  where id = p_sales_order_id;
end;
$$;

-- =====================================================================
-- PURCHASE ORDER RECEIVE FUNCTION
-- =====================================================================
create or replace function public.receive_purchase_order_item(
  p_po_item_id uuid,
  p_quantity_received numeric,
  p_actual_unit_cost numeric,
  p_location_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_item record;
  v_po record;
  v_lot_id uuid;
  v_all_received boolean;
begin
  select * into v_item from public.purchase_order_items where id = p_po_item_id for update;
  if v_item is null then
    raise exception 'PO item not found';
  end if;

  select * into v_po from public.purchase_orders where id = v_item.purchase_order_id for update;

  insert into public.inventory_lots (
    product_id, purchase_order_id, quantity_received, quantity_remaining,
    unit_cost, received_date, location_id
  ) values (
    v_item.product_id, v_item.purchase_order_id, p_quantity_received, p_quantity_received,
    p_actual_unit_cost, current_date, p_location_id
  ) returning id into v_lot_id;

  update public.purchase_order_items
  set quantity_received = quantity_received + p_quantity_received
  where id = p_po_item_id;

  update public.products
  set current_stock_quantity = current_stock_quantity + p_quantity_received
  where id = v_item.product_id;

  select coalesce(bool_and(quantity_received >= quantity_ordered), true)
  into v_all_received
  from public.purchase_order_items
  where purchase_order_id = v_item.purchase_order_id;

  if v_all_received then
    update public.purchase_orders
    set status = 'received', received_date = current_date
    where id = v_item.purchase_order_id;
  else
    update public.purchase_orders
    set status = 'partially_received'
    where id = v_item.purchase_order_id and status not in ('received','cancelled');
  end if;

  return v_lot_id;
end;
$$;

-- =====================================================================
-- COMMISSION CREATION FUNCTION
-- =====================================================================
create or replace function public.create_commission_for_so(p_sales_order_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_so record;
  v_user record;
  v_cogs numeric(12,2);
  v_net_profit numeric(12,2);
  v_commission_amount numeric(12,2);
  v_period text;
  v_record_id uuid;
  v_existing uuid;
begin
  select id into v_existing from public.commission_records where sales_order_id = p_sales_order_id;
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_so from public.sales_orders where id = p_sales_order_id;
  if v_so is null then
    raise exception 'Sales order not found';
  end if;
  if v_so.payment_status != 'paid' then
    raise exception 'Sales order must be paid to create commission';
  end if;

  select * into v_user from public.users where id = v_so.salesperson_id;

  select coalesce(sum(quantity * fifo_cost), 0)::numeric(12,2) into v_cogs
  from public.sales_order_items
  where sales_order_id = p_sales_order_id;

  v_net_profit := (v_so.subtotal - v_cogs - v_so.freight_charge - v_so.sales_tax_amount - v_so.credit_card_fee_amount)::numeric(12,2);
  v_commission_amount := (v_net_profit * coalesce(v_user.commission_rate, 0.1000))::numeric(12,2);

  -- commission_period = first day of month AFTER payment, formatted YYYY-MM
  v_period := to_char(
    (coalesce(v_so.payment_date, current_date) + interval '1 month'),
    'YYYY-MM'
  );

  insert into public.commission_records (
    salesperson_id, sales_order_id, invoice_date, payment_date,
    gross_revenue, freight_charge, sales_tax_amount, credit_card_fee_amount,
    cogs, net_profit, commission_rate, commission_amount, commission_period
  ) values (
    v_so.salesperson_id, v_so.id, coalesce(v_so.invoice_date, current_date), v_so.payment_date,
    v_so.subtotal, v_so.freight_charge, v_so.sales_tax_amount, v_so.credit_card_fee_amount,
    v_cogs, v_net_profit, coalesce(v_user.commission_rate, 0.1000), v_commission_amount, v_period
  ) returning id into v_record_id;

  return v_record_id;
end;
$$;

-- =====================================================================
-- STOCK ADJUSTMENT FUNCTION
-- =====================================================================
create or replace function public.apply_stock_adjustment(
  p_product_id uuid,
  p_quantity_delta numeric,
  p_reason text,
  p_unit_cost numeric default null,
  p_notes text default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_adj_id uuid;
  v_lot_id uuid;
  v_remaining numeric(12,4);
  v_take numeric(12,4);
  v_lot record;
begin
  if p_quantity_delta > 0 then
    insert into public.inventory_lots (
      product_id, quantity_received, quantity_remaining,
      unit_cost, received_date, notes
    ) values (
      p_product_id, p_quantity_delta, p_quantity_delta,
      coalesce(p_unit_cost, 0), current_date,
      'Stock adjustment: ' || p_reason
    ) returning id into v_lot_id;

    update public.products
    set current_stock_quantity = current_stock_quantity + p_quantity_delta
    where id = p_product_id;
  else
    v_remaining := abs(p_quantity_delta);
    for v_lot in
      select * from public.inventory_lots
      where product_id = p_product_id and quantity_remaining > 0
      order by received_date asc, created_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_lot.quantity_remaining);
      update public.inventory_lots
      set quantity_remaining = quantity_remaining - v_take
      where id = v_lot.id;
      v_remaining := v_remaining - v_take;
    end loop;

    update public.products
    set current_stock_quantity = greatest(current_stock_quantity + p_quantity_delta, 0)
    where id = p_product_id;
  end if;

  insert into public.stock_adjustments (
    product_id, quantity_delta, reason, unit_cost, notes, lot_id, created_by
  ) values (
    p_product_id, p_quantity_delta, p_reason, p_unit_cost, p_notes, v_lot_id, p_user_id
  ) returning id into v_adj_id;

  return v_adj_id;
end;
$$;

-- =====================================================================
-- HELPER: current user role
-- =====================================================================
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
as $$
  select coalesce((select role in ('admin','manager') from public.users where id = auth.uid()), false);
$$;

create or replace function public.is_not_viewer()
returns boolean
language sql
stable
security definer
as $$
  select coalesce((select role in ('admin','manager','salesperson') from public.users where id = auth.uid()), false);
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.locations enable row level security;
alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.sales_quotes enable row level security;
alter table public.sales_quote_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.commission_records enable row level security;
alter table public.email_logs enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.activity_log enable row level security;
alter table public.company_settings enable row level security;

-- ---- locations ----
drop policy if exists "auth can read locations" on public.locations;
create policy "auth can read locations" on public.locations
  for select using (auth.role() = 'authenticated');
drop policy if exists "admin can write locations" on public.locations;
create policy "admin can write locations" on public.locations
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- users ----
drop policy if exists "auth can read users" on public.users;
create policy "auth can read users" on public.users
  for select using (auth.role() = 'authenticated');
drop policy if exists "admin can insert users" on public.users;
create policy "admin can insert users" on public.users
  for insert with check (public.is_admin());
drop policy if exists "admin can update users" on public.users;
create policy "admin can update users" on public.users
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "user can update own" on public.users;
create policy "user can update own" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "admin can delete users" on public.users;
create policy "admin can delete users" on public.users
  for delete using (public.is_admin());

-- ---- customers ----
drop policy if exists "auth read customers" on public.customers;
create policy "auth read customers" on public.customers
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-viewer create customers" on public.customers;
create policy "non-viewer create customers" on public.customers
  for insert with check (public.is_not_viewer());
drop policy if exists "non-viewer update customers" on public.customers;
create policy "non-viewer update customers" on public.customers
  for update using (public.is_not_viewer()) with check (public.is_not_viewer());
drop policy if exists "admin delete customers" on public.customers;
create policy "admin delete customers" on public.customers
  for delete using (public.is_admin());

-- ---- suppliers ----
drop policy if exists "auth read suppliers" on public.suppliers;
create policy "auth read suppliers" on public.suppliers
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-viewer create suppliers" on public.suppliers;
create policy "non-viewer create suppliers" on public.suppliers
  for insert with check (public.is_not_viewer());
drop policy if exists "non-viewer update suppliers" on public.suppliers;
create policy "non-viewer update suppliers" on public.suppliers
  for update using (public.is_not_viewer()) with check (public.is_not_viewer());
drop policy if exists "admin delete suppliers" on public.suppliers;
create policy "admin delete suppliers" on public.suppliers
  for delete using (public.is_admin());

-- ---- products ----
drop policy if exists "auth read products" on public.products;
create policy "auth read products" on public.products
  for select using (auth.role() = 'authenticated');
drop policy if exists "mgr create products" on public.products;
create policy "mgr create products" on public.products
  for insert with check (public.is_admin_or_manager());
drop policy if exists "mgr update products" on public.products;
create policy "mgr update products" on public.products
  for update using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());
drop policy if exists "admin delete products" on public.products;
create policy "admin delete products" on public.products
  for delete using (public.is_admin());

-- ---- inventory_lots ----
drop policy if exists "auth read lots" on public.inventory_lots;
create policy "auth read lots" on public.inventory_lots
  for select using (auth.role() = 'authenticated');
drop policy if exists "mgr write lots" on public.inventory_lots;
create policy "mgr write lots" on public.inventory_lots
  for all using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

-- ---- purchase_orders ----
drop policy if exists "auth read po" on public.purchase_orders;
create policy "auth read po" on public.purchase_orders
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-viewer create po" on public.purchase_orders;
create policy "non-viewer create po" on public.purchase_orders
  for insert with check (public.is_not_viewer());
drop policy if exists "non-viewer update po" on public.purchase_orders;
create policy "non-viewer update po" on public.purchase_orders
  for update using (public.is_not_viewer()) with check (public.is_not_viewer());
drop policy if exists "admin delete po" on public.purchase_orders;
create policy "admin delete po" on public.purchase_orders
  for delete using (public.is_admin());

drop policy if exists "auth read poi" on public.purchase_order_items;
create policy "auth read poi" on public.purchase_order_items
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-viewer write poi" on public.purchase_order_items;
create policy "non-viewer write poi" on public.purchase_order_items
  for all using (public.is_not_viewer()) with check (public.is_not_viewer());

-- ---- sales_quotes ----
drop policy if exists "auth read quotes" on public.sales_quotes;
create policy "auth read quotes" on public.sales_quotes
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-viewer create quotes" on public.sales_quotes;
create policy "non-viewer create quotes" on public.sales_quotes
  for insert with check (public.is_not_viewer());
drop policy if exists "non-viewer update quotes" on public.sales_quotes;
create policy "non-viewer update quotes" on public.sales_quotes
  for update using (
    public.is_admin_or_manager() or salesperson_id = auth.uid()
  ) with check (
    public.is_admin_or_manager() or salesperson_id = auth.uid()
  );
drop policy if exists "admin delete quotes" on public.sales_quotes;
create policy "admin delete quotes" on public.sales_quotes
  for delete using (public.is_admin());

drop policy if exists "auth read quote items" on public.sales_quote_items;
create policy "auth read quote items" on public.sales_quote_items
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-viewer write quote items" on public.sales_quote_items;
create policy "non-viewer write quote items" on public.sales_quote_items
  for all using (public.is_not_viewer()) with check (public.is_not_viewer());

-- ---- sales_orders ----
drop policy if exists "auth read so" on public.sales_orders;
create policy "auth read so" on public.sales_orders
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-viewer create so" on public.sales_orders;
create policy "non-viewer create so" on public.sales_orders
  for insert with check (public.is_not_viewer());
drop policy if exists "non-viewer update so" on public.sales_orders;
create policy "non-viewer update so" on public.sales_orders
  for update using (
    public.is_admin_or_manager() or salesperson_id = auth.uid()
  ) with check (
    public.is_admin_or_manager() or salesperson_id = auth.uid()
  );
drop policy if exists "admin delete so" on public.sales_orders;
create policy "admin delete so" on public.sales_orders
  for delete using (public.is_admin());

drop policy if exists "auth read so items" on public.sales_order_items;
create policy "auth read so items" on public.sales_order_items
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-viewer write so items" on public.sales_order_items;
create policy "non-viewer write so items" on public.sales_order_items
  for all using (public.is_not_viewer()) with check (public.is_not_viewer());

-- ---- commission_records ----
drop policy if exists "read own or mgr all commissions" on public.commission_records;
create policy "read own or mgr all commissions" on public.commission_records
  for select using (
    public.is_admin_or_manager() or salesperson_id = auth.uid()
  );
drop policy if exists "system write commissions" on public.commission_records;
create policy "system write commissions" on public.commission_records
  for all using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

-- ---- email_logs ----
drop policy if exists "auth read email logs" on public.email_logs;
create policy "auth read email logs" on public.email_logs
  for select using (auth.role() = 'authenticated');
drop policy if exists "auth insert email logs" on public.email_logs;
create policy "auth insert email logs" on public.email_logs
  for insert with check (auth.role() = 'authenticated');

-- ---- stock_adjustments ----
drop policy if exists "auth read stock adj" on public.stock_adjustments;
create policy "auth read stock adj" on public.stock_adjustments
  for select using (auth.role() = 'authenticated');
drop policy if exists "mgr write stock adj" on public.stock_adjustments;
create policy "mgr write stock adj" on public.stock_adjustments
  for all using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

-- ---- activity_log ----
drop policy if exists "auth read activity" on public.activity_log;
create policy "auth read activity" on public.activity_log
  for select using (auth.role() = 'authenticated');
drop policy if exists "auth insert activity" on public.activity_log;
create policy "auth insert activity" on public.activity_log
  for insert with check (auth.role() = 'authenticated' and user_id = auth.uid());

-- ---- company_settings ----
drop policy if exists "auth read settings" on public.company_settings;
create policy "auth read settings" on public.company_settings
  for select using (auth.role() = 'authenticated');
drop policy if exists "admin update settings" on public.company_settings;
create policy "admin update settings" on public.company_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---- document_sequences (no RLS — function handles it) ----
alter table public.document_sequences enable row level security;
drop policy if exists "auth read seqs" on public.document_sequences;
create policy "auth read seqs" on public.document_sequences
  for select using (auth.role() = 'authenticated');

-- =====================================================================
-- GRANTS
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
