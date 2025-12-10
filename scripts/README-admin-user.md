# Creating Admin User

This guide explains how to create an admin user with the following credentials:
- **Email**: `admin@freedomtag.com`
- **Password**: `123456`
- **Role**: `ADMIN`

## Method 1: Using the API Script (Recommended)

**Prerequisites**: The server must be running on `http://localhost:3000`

1. Start the server:
   ```bash
   cd server
   npm run dev
   ```

2. In a new terminal, run the script:
   ```bash
   cd server
   npx tsx scripts/create-admin-user-api.ts
   ```

3. If the user already exists, you'll see a message. You can still try logging in.

## Method 2: Using the Signup API Directly

**Prerequisites**: The server must be running

Use curl or Postman to call the signup endpoint:

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@freedomtag.com",
    "password": "123456",
    "fullName": "Admin User",
    "role": "ADMIN"
  }'
```

Or use PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/auth/signup" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"email":"admin@freedomtag.com","password":"123456","fullName":"Admin User","role":"ADMIN"}'
```

## Method 3: Direct Database Insert (Advanced)

If you have direct database access, you can insert the user manually:

```sql
-- First, create the user (password hash for "123456" with bcrypt)
INSERT INTO users (id, email, password_hash, full_name, preferred_currency, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'admin@freedomtag.com',
  '$2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- Replace with actual bcrypt hash
  'Admin User',
  'ZAR',
  NOW(),
  NOW()
);

-- Then, get the user ID and create the ADMIN role
INSERT INTO user_roles (user_id, role, entity_id, created_at)
VALUES (
  (SELECT id FROM users WHERE email = 'admin@freedomtag.com'),
  'ADMIN',
  NULL,
  NOW()
);
```

**Note**: You'll need to generate the actual bcrypt hash for password "123456". You can use Node.js:
```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('123456', 10).then(hash => console.log(hash));
```

## After Creating the User

1. Go to: `http://localhost:5173/admin-freedomtag`
2. Login with:
   - Email: `admin@freedomtag.com`
   - Password: `123456`
3. You'll be redirected to `/admin` dashboard

## Troubleshooting

- **"User already exists"**: The user is already in the database. Try logging in directly.
- **"Internal server error"**: Check that the server is running and database is connected.
- **"Database connection not available"**: Check your `.env` file has `DATABASE_URL` or `SUPABASE_URL` set.

