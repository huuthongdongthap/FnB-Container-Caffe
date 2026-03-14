#!/usr/bin/env node
/**
 * CTO Brain FnB v1 — File-based Task Queue Dispatcher
 * Replicated from openclaw-worker auto-cto-pilot.js
 * Manages window fnb (P1, P2, P3) in session tom_hum
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SESSION = 'tom_hum';
const WINDOW = 'fnb';
const TASKS_DIR = path.join(__dirname, 'tasks');
const DONE_DIR = path.join(__dirname, 'tasks-done');
const POLL_MS = 10000; // 10s polling
const WORKER_PANES = [1, 2, 3]; // P1, P2, P3

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`);
}

function isPaneIdle(paneIdx) {
  try {
    const output = execSync(
      `tmux capture-pane -t ${SESSION}:${WINDOW}.${paneIdx} -p -S -10 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    const lines = output.split('\n').filter(l => l.trim());
    const tail5 = lines.slice(-5).join('\n');
    const hasPrompt = /❯/.test(tail5);
    const isBusy = /thinking|Cogitat|Reading|Writing|Editing|Searching|Proofing|Cooking|Brewing|Frosting|Moonwalking|Concocting|Sautéing|Churning|queued messages|Press up to edit/i.test(tail5);
    return hasPrompt && !isBusy;
  } catch (e) {
    return false;
  }
}

function getNextTask() {
  try {
    const files = fs.readdirSync(TASKS_DIR)
      .filter(f => f.endsWith('.txt') || f.endsWith('.json'))
      .sort((a, b) => {
        // Priority: CRITICAL > HIGH > MEDIUM > LOW
        const prio = name => {
          if (name.startsWith('CRITICAL')) return 0;
          if (name.startsWith('HIGH')) return 1;
          if (name.startsWith('MEDIUM')) return 2;
          return 3;
        };
        return prio(a) - prio(b) || 
          fs.statSync(path.join(TASKS_DIR, a)).mtimeMs - fs.statSync(path.join(TASKS_DIR, b)).mtimeMs;
      });
    return files[0] || null;
  } catch (e) {
    return null;
  }
}

function getTargetPane(filename) {
  const lower = filename.toLowerCase();
  if (/p1|builder|build|index|html|responsive/.test(lower)) return 1;
  if (/p2|tester|test|grep|verify|audit/.test(lower)) return 2;
  if (/p3|designer|design|style|css|visual/.test(lower)) return 3;
  // Round-robin fallback
  const hash = filename.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return WORKER_PANES[hash % WORKER_PANES.length];
}

function dispatch(paneIdx, taskContent, taskFile) {
  const pane = `${SESSION}:${WINDOW}.${paneIdx}`;
  const firstLine = taskContent.trim().split('\n')[0];
  
  log(`📨 P${paneIdx}: ${firstLine.slice(0, 80)}...`);
  
  try {
    execSync(`tmux send-keys -t ${pane} C-u 2>/dev/null`, { timeout: 3000 });
    execSync(`tmux send-keys -t ${pane} -l "${firstLine.replace(/"/g, '\\"')}"`, { timeout: 5000 });
    execSync(`tmux send-keys -t ${pane} Enter`, { timeout: 3000 });
    
    // Move to done
    fs.renameSync(
      path.join(TASKS_DIR, taskFile),
      path.join(DONE_DIR, `${Date.now()}_${taskFile}`)
    );
    log(`✅ P${paneIdx}: Dispatched + archived → ${taskFile}`);
    return true;
  } catch (e) {
    log(`❌ P${paneIdx}: Dispatch failed — ${e.message}`);
    return false;
  }
}

// Main loop
function mainLoop() {
  const taskFile = getNextTask();
  
  if (!taskFile) {
    // No tasks — idle
    return;
  }
  
  const targetPane = getTargetPane(taskFile);
  
  if (isPaneIdle(targetPane)) {
    const content = fs.readFileSync(path.join(TASKS_DIR, taskFile), 'utf-8');
    dispatch(targetPane, content, taskFile);
  } else {
    // Try other panes
    for (const pane of WORKER_PANES) {
      if (pane !== targetPane && isPaneIdle(pane)) {
        const content = fs.readFileSync(path.join(TASKS_DIR, taskFile), 'utf-8');
        dispatch(pane, content, taskFile);
        return;
      }
    }
    log(`⏳ All workers busy — waiting (${taskFile})`);
  }
}

// Status display
function showStatus() {
  const tasks = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.json'));
  const paneStatus = WORKER_PANES.map(p => `P${p}:${isPaneIdle(p) ? '🟢' : '🔴'}`).join(' ');
  log(`📊 ${paneStatus} | Queue: ${tasks.length} task(s)`);
}

// Start
log('═══════════════════════════════════════');
log('🦞 CTO BRAIN FnB v1 — STARTED');
log(`   Queue: ${TASKS_DIR}`);
log(`   Workers: P1, P2, P3 in ${SESSION}:${WINDOW}`);
log('═══════════════════════════════════════');

showStatus();
setInterval(() => {
  mainLoop();
}, POLL_MS);

setInterval(() => {
  showStatus();
}, 60000); // Status every 60s
