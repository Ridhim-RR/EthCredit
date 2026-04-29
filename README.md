This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This repository uses separate package files for frontend and backend. The backend uses PostgreSQL with Prisma ORM.

### Prerequisites

- PostgreSQL running locally or via Docker
- Node.js 18+

### Installation

#### Frontend Setup

Install frontend dependencies in the frontend folder:

```bash
cd frontend
npm install
```

#### Backend Setup

Install backend dependencies in the backend folder:

```bash
cd backend
npm install
```

Set up the database:

1. Ensure PostgreSQL is running on localhost:5432 (or update `DATABASE_URL` in `backend/.env`)
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`:

```bash
cd backend
cp .env.example .env
# Edit .env and update DATABASE_URL (e.g., postgresql://postgres:password@localhost:5432/ethcredit)
```

3. Run database migrations:

```bash
cd backend
npm run db:migrate
```

4. Generate Prisma client:

```bash
cd backend
npm run prisma:generate
```

### Running the Application

**Frontend only** (from project root):

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

**Backend only** (from project root):

```bash
npm run dev:backend
```

**Both simultaneously** (from project root in separate terminals):

Terminal 1:
```bash
npm run dev
```

Terminal 2:
```bash
npm run dev:backend
```

Open [http://localhost:3000](http://localhost:3000) to access the frontend. Backend API runs on `http://localhost:5000`.

### Database

- **Engine**: PostgreSQL
- **ORM**: Prisma
- **Migrations**: Located in `backend/db/migrations/` (SQL files)
- **Schema Definition**: `backend/prisma/schema.prisma`

#### Common Database Tasks

List all agents:
```bash
curl http://localhost:5000/agents/list
```

Bootstrap default agent:
```bash
curl http://localhost:5000/agents/bootstrap
```

Check backend health:
```bash
curl http://localhost:5000/health
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
