-- Create contacts table for storing form submissions
-- Run this SQL in your Supabase SQL Editor

-- Drop table if exists to avoid conflicts
DROP TABLE IF EXISTS contacts;

CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  id_number VARCHAR(50) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS) - optional
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid duplicates on re-run)
DROP POLICY IF EXISTS "Allow public inserts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated select" ON contacts;

-- Create a policy to allow anyone to insert (for the public form)
CREATE POLICY "Allow public inserts" ON contacts
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create a policy to allow authenticated users to select
CREATE POLICY "Allow authenticated select" ON contacts
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- Drop existing payments table if it exists (to avoid column conflicts)
DROP TABLE IF EXISTS payments CASCADE;

-- Create payments table for Paystack transactions
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(255) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  package_limit VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  paid_at TIMESTAMP WITH TIME ZONE,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS) for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid duplicates on re-run)
DROP POLICY IF EXISTS "Allow public inserts on payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated select on payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated update on payments" ON payments;

-- Create a policy to allow anyone to insert (for payment initiation)
CREATE POLICY "Allow public inserts on payments" ON payments
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create a policy to allow authenticated users to select
CREATE POLICY "Allow authenticated select on payments" ON payments
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a policy to allow authenticated users to update (for status updates)
CREATE POLICY "Allow authenticated update on payments" ON payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_email ON payments(email);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON payments(phone);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
