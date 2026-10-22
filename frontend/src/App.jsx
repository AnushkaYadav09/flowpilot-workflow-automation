
import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Workflow,
  Plus,
  Play,
  Save,
  Mail,
  GitBranch,
  Zap,
  Trash2,
} from 'lucide-react'
import './index.css'

const initialNodes = [
  {
    id: '1',
    type: 'automation',
    position: { x: 100, y: 100 },
    data: { label: 'Manual Trigger', kind: 'trigger' },
  },
  {
    id: '2',
    type: 'automation',
    position: { x: 390, y: 100 },
    data: { label: 'Send Email', kind: 'action' },
  },
]

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
]

function AutomationNode({ data }) {
  const Icon =
    data.kind === 'trigger' ? Zap :
    data.kind === 'condition' ? GitBranch : Mail

  return (
    <div className="automation-node">
      <Handle type="target" position={Position.Left} />
      <div className={`node-icon ${data.kind}`}>
        <Icon size={19} />
      </div>
      <div className="node-copy">
        <span>{data.kind}</span>
        <strong>{data.label}</strong>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { automation: AutomationNode }

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [workflowName, setWorkflowName] = useState('My first workflow')
  const [message, setMessage] = useState('Ready to build')
  const [nextId, setNextId] = useState(3)

  const API_URL = 'http://127.0.0.1:8000/api/workflows'

  const [savedWorkflowId, setSavedWorkflowId] = useState(null)
  const [savedWorkflows, setSavedWorkflows] = useState([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')

  const [executionLogs, setExecutionLogs] = useState([])
  const [runHistory, setRunHistory] = useState([])
  const [isRunning, setIsRunning] = useState(false)

  const onConnect = useCallback(
    (connection) => setEdges((current) =>
      addEdge({ ...connection, animated: true }, current)
    ),
    [setEdges],
  )

  useEffect(() => {
  async function fetchWorkflows() {
    try {
      const response = await fetch(API_URL)

      if (!response.ok) {
        throw new Error('Could not fetch workflows')
      }

      const data = await response.json()
      setSavedWorkflows(data)
    } catch (error) {
      setMessage('Backend unavailable. Check that FastAPI is running.')
    }
  }

    fetchWorkflows()
  }, [])

  function addNode(kind) {
    const labels = {
      trigger: 'Manual Trigger',
      action: 'Send Email',
      condition: 'Condition',
    }

    const node = {
      id: String(nextId),
      type: 'automation',
      position: { x: 120 + (nodes.length % 3) * 70, y: 230 + nodes.length * 35 },
      data: { label: labels[kind], kind },
    }

    setNodes((current) => [...current, node])
    setNextId((id) => id + 1)
    setMessage(`${labels[kind]} node added`)
  }

  function deleteSelected() {
    const selectedIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id),
    )

    if (!selectedIds.size) {
      setMessage('Select a node on the canvas first')
      return
    }

    setNodes((current) => current.filter((node) => !selectedIds.has(node.id)))
    setEdges((current) =>
      current.filter((edge) =>
        !selectedIds.has(edge.source) && !selectedIds.has(edge.target)
      )
    )
    setMessage('Selected node deleted')
  }

  async function saveDraft() {
  const payload = {
    name: workflowName.trim(),
    nodes,
    edges,
  }

  if (!payload.name) {
    setMessage('Please enter a workflow name')
    return
  }

  try {
    const isUpdate = savedWorkflowId !== null

    const response = await fetch(
      isUpdate ? `${API_URL}/${savedWorkflowId}` : API_URL,
      {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Could not save workflow')
    }

    const saved = await response.json()

    setSavedWorkflowId(saved.id)
    setSelectedWorkflowId(String(saved.id))
    setSavedWorkflows((current) => {
      const exists = current.some((item) => item.id === saved.id)

      return exists
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current]
    })

      setMessage(`Workflow "${saved.name}" saved successfully!`)
    } catch (error) {
      setMessage(`Save failed: ${error.message}`)
    }
  }

  async function loadWorkflow() {
  if (!selectedWorkflowId) {
    setMessage('Please select a saved workflow')
    return
  }

  try {
    const response = await fetch(
      `${API_URL}/${selectedWorkflowId}`
    )

    if (!response.ok) {
      throw new Error('Could not load workflow')
    }

    const workflow = await response.json()

    setWorkflowName(workflow.name)
    setNodes(workflow.nodes)
    setEdges(workflow.edges)
    setSavedWorkflowId(workflow.id)
    setMessage(`Loaded "${workflow.name}" successfully`)
    } catch (error) {
      setMessage(`Load failed: ${error.message}`)
    }
  }

  
  async function runPreview() {
    if (!nodes.length) {
      setMessage('Add at least one node before running')
      return
    }

    setIsRunning(true)
    setExecutionLogs([])

    try {
      // Save the latest canvas before running it
      const payload = {
        name: workflowName.trim(),
        nodes,
        edges,
      }

      if (!payload.name) {
        throw new Error('Please enter a workflow name')
      }

      const isUpdate = savedWorkflowId !== null

      const saveResponse = await fetch(
        isUpdate ? `${API_URL}/${savedWorkflowId}` : API_URL,
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!saveResponse.ok) {
        const error = await saveResponse.json()
        throw new Error(
          typeof error.detail === 'string'
            ? error.detail
            : 'Could not save workflow'
        )
      }

      const saved = await saveResponse.json()

      setSavedWorkflowId(saved.id)
      setSelectedWorkflowId(String(saved.id))
      setSavedWorkflows((current) => {
        const exists = current.some((item) => item.id === saved.id)
        return exists
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [saved, ...current]
      })

      // Run the saved workflow
      const runResponse = await fetch(
        `${API_URL}/${saved.id}/run`,
        { method: 'POST' }
      )

      const result = await runResponse.json()

      if (!runResponse.ok) {
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'Workflow execution failed'
        )
      }

      setExecutionLogs(result.logs || [])
      setMessage(`Workflow run completed: ${result.status}`)

      // Refresh saved execution history
      const historyResponse = await fetch(
        `${API_URL}/${saved.id}/runs`
      )

      if (historyResponse.ok) {
        const history = await historyResponse.json()
        setRunHistory(Array.isArray(history) ? history : [])
      }
    } catch (error) {
      setMessage(`Run failed: ${error.message}`)
    } finally {
      setIsRunning(false)
    }
  }


  return (
    <div className="builder-app">
      <header className="builder-topbar">
        <div className="builder-brand">
          <div className="brand-symbol"><Workflow size={22} /></div>
          <div><strong>FlowPilot</strong><span>WORKFLOW BUILDER</span></div>
        </div>
        <input
          className="workflow-name"
          value={workflowName}
          onChange={(event) => setWorkflowName(event.target.value)}
          aria-label="Workflow name"
        />
        <div className="builder-actions">
          <select
            className="workflow-name"
            value={selectedWorkflowId}
            onChange={(event) => setSelectedWorkflowId(event.target.value)}
            aria-label="Select saved workflow"
          >
            <option value="">Load saved workflow...</option>
            {savedWorkflows.map((workflow) => (
              <option key={workflow.id} value={String(workflow.id)}>
                {workflow.name}
              </option>
            ))}
          </select>

          <button className="secondary-button" onClick={loadWorkflow}>
            Load
          </button>
          <button className="secondary-button" onClick={saveDraft}>
            <Save size={16} /> Save draft
          </button>
           <button
            className="primary-button"
            onClick={runPreview}
            disabled={isRunning}
          >
            <Play size={16} />
            {isRunning ? 'Running...' : 'Run Workflow'}
          </button>
        </div>
      </header>

      <div className="builder-layout">
        <aside className="node-library">
          <p className="eyebrow">WORKFLOW COMPONENTS</p>
          <h3>Node library</h3>
          <p className="library-description">Add a block to your canvas.</p>

          <button className="node-library-item" onClick={() => addNode('trigger')}>
            <span className="library-icon trigger"><Zap size={18} /></span>
            <span><strong>Manual Trigger</strong><small>Start a workflow</small></span>
            <Plus size={15} />
          </button>

          <button className="node-library-item" onClick={() => addNode('action')}>
            <span className="library-icon action"><Mail size={18} /></span>
            <span><strong>Send Email</strong><small>Send a notification</small></span>
            <Plus size={15} />
          </button>

          <button className="node-library-item" onClick={() => addNode('condition')}>
            <span className="library-icon condition"><GitBranch size={18} /></span>
            <span><strong>Condition</strong><small>Branch by a rule</small></span>
            <Plus size={15} />
          </button>

          <div className="library-footer">
            <button className="secondary-button" onClick={deleteSelected}>
              <Trash2 size={16} /> Delete selected
            </button>
          </div>
        </aside>

        <main className="canvas-panel">
          <div className="canvas-heading">
            <div><strong>Workflow canvas</strong><span>Connect nodes by dragging between their handles.</span></div>
            <span className="draft-pill">Draft</span>
          </div>

          <div className="flow-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              deleteKeyCode="Delete"
            >
              <Background color="#344057" gap={22} />
              <Controls />
              <MiniMap nodeColor="#8178ef" maskColor="rgba(7, 12, 26, 0.65)" />
            </ReactFlow>
          </div>

          <div className="builder-status">
            <span className="status-indicator" />
            {message}
            <span className="canvas-count">{nodes.length} nodes · {edges.length} connections</span>
          </div>
          <section className="execution-panel">
          <div className="execution-header">
            <h3>Execution Logs</h3>
            <span>{executionLogs.length} steps</span>
          </div>
          {executionLogs.length === 0 ? (
          <p className="execution-empty">
            Run your workflow to see node execution results.
          </p>
        ) : (
          <div className="execution-list">
            {executionLogs.map((log, index) => (
          <div
            className="execution-item"
            key={`${log.node_id}-${index}`}
          >
            <div>
              <strong>{log.node || log.node_id}</strong>
              <p>{log.message}</p>
            </div>
            <span className="execution-status">
              {log.status}
            </span>
            </div>
          ))}
          </div>
          )}

          <div className="execution-header history-header">
            <h3>Run History</h3>
            <button
              className="secondary-button"
              onClick={async () => {
              if (!savedWorkflowId) {
                setMessage('Save or run a workflow first')
              return
            }

          try {
            const response = await fetch(
              `${API_URL}/${savedWorkflowId}/runs`
            )

            if (!response.ok) {
              throw new Error('Could not load run history')
            }

            const history = await response.json()
            setRunHistory(Array.isArray(history) ? history : [])
            setMessage('Run history refreshed')
          } catch (error) {
            setMessage(`History failed: ${error.message}`)
          }
          }}
          >
            Refresh history
          </button>
          </div>

          {runHistory.length === 0 ? (
            <p className="execution-empty">No saved runs yet.</p>
          ) : (
          <div className="execution-list">
            {runHistory.map((run) => (
          <div className="execution-item" key={run.id}>
            <div>
              <strong>Run #{run.id}</strong>
              <p>{run.started_at || 'Start time unavailable'}</p>
            </div>
            <span className="execution-status">
              {run.status}
            </span>
            </div>
            ))}
          </div>
          )}
          </section>

          </main>
        </div>
    </div>
  )
}
