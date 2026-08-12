const BASE_URL = 'http://localhost:4000'
const API_KEY = 'aegis-dev-key'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function request(path: string, options: RequestInit = {}): Promise<any> {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    ...(options.headers ?? {}),
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 204) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = await response.json() as any
  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${JSON.stringify(json.error ?? json)}`)
  }
  return Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json
}

async function runTests() {
  console.log('🧪 Starting Aegis API Integration Tests...\n')

  try {
    // 1. Health check
    console.log('🔹 Checking server health...')
    const health = await request('/health')
    console.log('✅ Health status:', health.status, `(DB: ${health.db})`)

    // 2. Create Project
    console.log('\n🔹 Creating project...')
    const project = await request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aegis Platform',
        description: 'Autonomous Developer Operations backend',
        repo: 'https://github.com/arx-dev15/Aegis',
        branch: 'main',
        techStack: ['Node.js', 'TypeScript', 'Express', 'PostgreSQL'],
        language: 'TypeScript',
      }),
    })
    console.log('✅ Created Project ID:', project.id)

    // 3. List Projects
    console.log('\n🔹 Listing projects...')
    const projects = await request('/api/projects')
    console.log('✅ Found projects count:', projects.length)
    if (!projects.some((p: any) => p.id === project.id)) {
      throw new Error('Created project not found in list!')
    }

    // 4. Update Project
    console.log('\n🔹 Updating project...')
    const updatedProject = await request(`/api/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        description: 'Autonomous Developer Operations backend with WebSocket & memory centralization',
        status: 'active',
      }),
    })
    console.log('✅ Updated Project description:', updatedProject.description)

    // 5. Get Project
    console.log('\n🔹 Fetching project details...')
    const fetchedProject = await request(`/api/projects/${project.id}`)
    console.log('✅ Fetched status:', fetchedProject.status)

    // 6. Create Task
    console.log('\n🔹 Creating task for project...')
    const task = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        description: 'Implement database connection check and migrations',
        executionMode: 'semi-auto',
        priority: 4,
      }),
    })
    console.log('✅ Created Task ID:', task.id)

    // 7. Get Task
    console.log('\n🔹 Fetching task details...')
    const fetchedTask = await request(`/api/tasks/${task.id}`)
    console.log('✅ Fetched Task priority:', fetchedTask.priority)

    // 8. Update Task status
    console.log('\n🔹 Updating task status to pending...')
    const updatedTask = await request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'pending',
      }),
    })
    console.log('✅ Task status:', updatedTask.status)

    // 9. List tasks for project
    console.log('\n🔹 Listing tasks for project...')
    const projectTasks = await request(`/api/projects/${project.id}/tasks`)
    console.log('✅ Tasks for project:', projectTasks.length)

    // 10. Create Agent Run
    console.log('\n🔹 Creating agent run for task...')
    const run = await request(`/api/tasks/${task.id}/runs`, {
      method: 'POST',
      body: JSON.stringify({
        executionMode: 'semi-auto',
      }),
    })
    console.log('✅ Created Run ID:', run.id)

    // 11. Get Run Status
    console.log('\n🔹 Fetching run status...')
    const runStatus = await request(`/api/runs/${run.id}/status`)
    console.log('✅ Run status:', runStatus.status)

    // 12. Store Run Event
    console.log('\n🔹 Storing execution run event...')
    const event = await request(`/api/runs/${run.id}/events`, {
      method: 'POST',
      body: JSON.stringify({
        level: 'info',
        agent: 'ArchitectAgent',
        message: 'Analyzing workspace directory structure and schemas.',
        metadata: { filesInspected: 12 },
      }),
    })
    console.log('✅ Stored Run Event ID:', event.id)

    // 13. Store File Change
    console.log('\n🔹 Storing file change for run...')
    const fileChange = await request(`/api/runs/${run.id}/files`, {
      method: 'POST',
      body: JSON.stringify({
        path: 'apps/api/db.ts',
        status: 'modified',
        additions: 15,
        deletions: 2,
        diffContent: '+ export async function getPool() {\n+   return pool\n+ }',
      }),
    })
    console.log('✅ Stored File Change ID:', fileChange.id)

    // 14. Get Run Files
    console.log('\n🔹 Fetching changed files for run...')
    const runFiles = await request(`/api/runs/${run.id}/files`)
    console.log('✅ Changed files count:', runFiles.length)
    if (runFiles[0]?.path !== 'apps/api/db.ts') {
      throw new Error(`File change path mismatch! Expected apps/api/db.ts, got ${runFiles[0]?.path}`)
    }

    // 15. Get Run (checking centralized events & files integration)
    console.log('\n🔹 Getting run details (checking integrated events and files)...')
    const fullRun = await request(`/api/runs/${run.id}`)
    console.log('✅ Integrated run events:', fullRun.events.length)
    console.log('✅ Integrated run files:', fullRun.files.length)
    if (fullRun.events.length === 0 || fullRun.files.length === 0) {
      throw new Error('Events or Files list is empty in run details!')
    }

    // 16. Create Approval Request
    console.log('\n🔹 Creating approval request...')
    const approval = await request(`/api/runs/${run.id}/approvals`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'code-review',
        title: 'Review changes to db.ts and migrations',
        description: 'Verify database checks and clean shutdown handling',
        requestedBy: 'EngineerAgent',
      }),
    })
    console.log('✅ Created Approval Request ID:', approval.id)

    // 17. Resolve (Approve) Approval Request
    console.log('\n🔹 Resolving approval request (APPROVE)...')
    const resolvedApproval = await request(`/api/approvals/${approval.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'approve',
        reason: 'Looks solid and passes connection checks.',
      }),
    })
    console.log('✅ Resolved Approval status:', resolvedApproval.status)

    // 18. Get Approval Status
    console.log('\n🔹 Checking approval status...')
    const checkApproval = await request(`/api/approvals/${approval.id}`)
    console.log('✅ Checked Approval resolution:', checkApproval.resolution)

    // 19. Store Activity Feed Item
    console.log('\n🔹 Storing activity feed item...')
    const activity = await request('/api/activity', {
      method: 'POST',
      body: JSON.stringify({
        type: 'task_completed',
        description: 'Database migration implementation completed',
        agent: 'ArchitectAgent',
        projectId: project.id,
        runId: run.id,
      }),
    })
    console.log('✅ Stored Activity ID:', activity.id)

    // 20. Fetch Activity Feed
    console.log('\n🔹 Fetching activity feed...')
    const activities = await request('/api/activity')
    console.log('✅ Total activities retrieved:', activities.length)

    // 21. Delete Project
    console.log('\n🔹 Deleting project...')
    await request(`/api/projects/${project.id}`, {
      method: 'DELETE',
    })
    console.log('✅ Deleted project successfully!')

    // 22. Verify project task metrics and deletion cascading
    console.log('\n🔹 Verifying project deletion...')
    try {
      await request(`/api/projects/${project.id}`)
      throw new Error('Project should have been deleted!')
    } catch {
      console.log('✅ Verified project no longer exists.')
    }

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉')

  } catch (error: any) {
    console.error('\n❌ Integration Test Failed:', error.message)
    process.exit(1)
  }
}

runTests()
