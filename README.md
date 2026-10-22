# FlowPilot — Visual Workflow Automation Builder

FlowPilot is a visual workflow automation platform that allows users to design, save, and simulate workflows through an interactive node-based interface.

## Features

- **Visual Workflow Builder:** Create workflows using a node-based editor.
- **Workflow Nodes:** Supports Manual Trigger, Send Email, and Condition nodes.
- **Workflow Connections:** Connect nodes to define workflow structure.
- **Workflow Management:** Create, save, load, update, and delete workflows.
- **Workflow Execution Simulation:** Run workflows and inspect simulated execution results.
- **Execution Logs:** View node-level execution statuses and messages.
- **Run History:** Retrieve previous workflow runs.
- **Cycle Validation:** Reject workflows containing circular connections.
- **REST API:** Backend endpoints for workflow management and execution.

## Tech Stack

**Frontend**
- React
- Vite
- React Flow
- Lucide React
- CSS

**Backend**
- Python
- FastAPI
- SQLModel
- SQLite

## Project Structure

```text
agentic-workflow-builder/
├── backend/
├── frontend/
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.10 or later
- Git

### 1. Clone the repository

```bash
git clone https://github.com/AnushkaYadav09/flowpilot-workflow-automation.git
cd flowpilot-workflow-automation
```

### 2. Start the backend

Open a terminal in the project root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment on Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies using the project's dependency file, if available. For example, if the file is `requirements.txt`:

```bash
pip install -r requirements.txt
```

Start the FastAPI server using the actual application module:

```bash
uvicorn main:app --reload
```

The backend API is available at `http://127.0.0.1:8000`.

Interactive API documentation: `http://127.0.0.1:8000/docs`

### 3. Start the frontend

Open a second terminal at the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/workflows` | Create a workflow |
| GET | `/api/workflows` | List saved workflows |
| GET | `/api/workflows/{workflow_id}` | Retrieve a workflow |
| PUT | `/api/workflows/{workflow_id}` | Update a workflow |
| DELETE | `/api/workflows/{workflow_id}` | Delete a workflow |
| POST | `/api/workflows/{workflow_id}/run` | Simulate a workflow run |
| GET | `/api/workflows/{workflow_id}/runs` | Retrieve run history |

## Current Limitations

- Workflow execution is currently simulated.
- The Send Email node does not send real emails yet.
- External integrations and scheduled execution can be added in future versions.

## Future Enhancements

- Real email integration
- Workflow scheduling
- Additional action and trigger nodes
- External service integrations
- User authentication and workflow access control
- Deployment with a public demo

## Author

**Anushka Yadav**

GitHub: [AnushkaYadav09](https://github.com/AnushkaYadav09)
