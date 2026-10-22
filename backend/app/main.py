
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import SQLModel, Field, Session, create_engine, select


DATABASE_URL = "sqlite:///./workflows.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


class Workflow(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=150)
    nodes_json: str = Field(default="[]")
    edges_json: str = Field(default="[]")
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class WorkflowInput(BaseModel):
    name: str = PydanticField(min_length=1, max_length=150)
    nodes: list[dict] = []
    edges: list[dict] = []


class WorkflowRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    workflow_id: int = Field(index=True)
    status: str = Field(default="pending")
    logs_json: str = Field(default="[]")
    started_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    finished_at: str | None = Field(default=None)


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield


app = FastAPI(
    title="Agentic Workflow Automation Builder",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize_workflow(workflow: Workflow) -> dict:
    return {
        "id": workflow.id,
        "name": workflow.name,
        "nodes": json.loads(workflow.nodes_json),
        "edges": json.loads(workflow.edges_json),
        "created_at": workflow.created_at,
        "updated_at": workflow.updated_at,
    }


@app.get("/")
def home():
    return {
        "message": "Agentic Workflow Automation Builder API",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "agentic-workflow-builder",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/workflows", status_code=201)
def create_workflow(payload: WorkflowInput):
    name = payload.name.strip()
    if not name:
        raise HTTPException(422, "Workflow name cannot be empty")

    now = datetime.now(timezone.utc).isoformat()
    workflow = Workflow(
        name=name,
        nodes_json=json.dumps(payload.nodes),
        edges_json=json.dumps(payload.edges),
        created_at=now,
        updated_at=now,
    )

    with Session(engine) as session:
        session.add(workflow)
        session.commit()
        session.refresh(workflow)
        return serialize_workflow(workflow)


@app.get("/api/workflows")
def list_workflows():
    with Session(engine) as session:
        workflows = session.exec(
            select(Workflow).order_by(Workflow.id.desc())
        ).all()
        return [serialize_workflow(w) for w in workflows]


@app.get("/api/workflows/{workflow_id}")
def get_workflow(workflow_id: int):
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if workflow is None:
            raise HTTPException(404, "Workflow not found")
        return serialize_workflow(workflow)


@app.put("/api/workflows/{workflow_id}")
def update_workflow(workflow_id: int, payload: WorkflowInput):
    name = payload.name.strip()
    if not name:
        raise HTTPException(422, "Workflow name cannot be empty")

    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if workflow is None:
            raise HTTPException(404, "Workflow not found")

        workflow.name = name
        workflow.nodes_json = json.dumps(payload.nodes)
        workflow.edges_json = json.dumps(payload.edges)
        workflow.updated_at = datetime.now(timezone.utc).isoformat()

        session.add(workflow)
        session.commit()
        session.refresh(workflow)
        return serialize_workflow(workflow)


@app.delete("/api/workflows/{workflow_id}")
def delete_workflow(workflow_id: int):
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if workflow is None:
            raise HTTPException(404, "Workflow not found")

        session.delete(workflow)
        session.commit()

    return {"message": "Workflow deleted", "id": workflow_id}


from collections import deque


def validate_and_order(nodes: list[dict], edges: list[dict]):
    if not nodes:
        raise HTTPException(422, "Workflow has no nodes")

    node_map = {}

    for node in nodes:
        node_id = node.get("id")
        data = node.get("data", {})
        kind = data.get("kind") or node.get("kind") or node.get("type")

        if not node_id or node_id in node_map:
            raise HTTPException(422, "Every node needs a unique ID")

        if kind not in {"trigger", "action", "condition"}:
            raise HTTPException(
                422, f"Unsupported node type: {kind}"
            )

        node_map[node_id] = node

    if not any(
    (node.get("data", {}).get("kind")
     or node.get("kind")
     or node.get("type")) == "trigger"
    for node in nodes
   ):
        raise HTTPException(
            422, "Workflow needs at least one trigger"
        )

    adjacency = {node_id: [] for node_id in node_map}
    indegree = {node_id: 0 for node_id in node_map}
    seen_edges = set()

    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")

        if source not in node_map or target not in node_map:
            raise HTTPException(
                422, "Connection references a missing node"
            )

        if source == target:
            raise HTTPException(
                422, "A node cannot connect to itself"
            )

        pair = (source, target)
        if pair in seen_edges:
            raise HTTPException(
                422, "Duplicate connection detected"
            )

        seen_edges.add(pair)
        adjacency[source].append(target)
        indegree[target] += 1

    queue = deque(
        node_id for node_id, degree in indegree.items()
        if degree == 0
    )
    ordered_ids = []

    while queue:
        node_id = queue.popleft()
        ordered_ids.append(node_id)

        for target in adjacency[node_id]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)

    if len(ordered_ids) != len(node_map):
        raise HTTPException(
            422, "Workflow contains a cycle"
        )

    return [node_map[node_id] for node_id in ordered_ids]


@app.post("/api/workflows/{workflow_id}/run", status_code=201)
def run_workflow(workflow_id: int):
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)

        if workflow is None:
            raise HTTPException(404, "Workflow not found")

        nodes = json.loads(workflow.nodes_json)
        edges = json.loads(workflow.edges_json)

        ordered_nodes = validate_and_order(nodes, edges)

        started_at = datetime.now(timezone.utc).isoformat()
        logs = []

        for node in ordered_nodes:
            data = node.get("data", {})
            kind = data["kind"]
            label = data.get("label", kind)

            if kind == "trigger":
                message = "Trigger processed (simulated)"
                node_status = "success"
            elif kind == "condition":
                message = "Condition step simulated; no rule evaluated"
                node_status = "simulated"
            else:
                message = (
                    "Action simulated; no external action performed"
                )
                node_status = "simulated"

            logs.append({
                "node_id": node["id"],
                "node": label,
                "kind": kind,
                "status": node_status,
                "message": message,
                "timestamp": datetime.now(
                    timezone.utc
                ).isoformat(),
            })

        finished_at = datetime.now(timezone.utc).isoformat()

        run_record = WorkflowRun(
            workflow_id=workflow_id,
            status="completed_simulation",
            logs_json=json.dumps(logs),
            started_at=started_at,
            finished_at=finished_at,
        )

        session.add(run_record)
        session.commit()
        session.refresh(run_record)

        return {
            "run_id": run_record.id,
            "workflow_id": workflow_id,
            "status": run_record.status,
            "started_at": run_record.started_at,
            "finished_at": run_record.finished_at,
            "logs": logs,
            "note": (
                "Simulation only. Emails and other external "
                "actions have not been performed."
            ),
        }


@app.get("/api/workflows/{workflow_id}/runs")
def get_workflow_runs(workflow_id: int):
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)

        if workflow is None:
            raise HTTPException(404, "Workflow not found")

        runs = session.exec(
            select(WorkflowRun)
            .where(WorkflowRun.workflow_id == workflow_id)
            .order_by(WorkflowRun.id.desc())
        ).all()

        return [
            {
                "id": run.id,
                "workflow_id": run.workflow_id,
                "status": run.status,
                "logs": json.loads(run.logs_json),
                "started_at": run.started_at,
                "finished_at": run.finished_at,
            }
            for run in runs
        ]
