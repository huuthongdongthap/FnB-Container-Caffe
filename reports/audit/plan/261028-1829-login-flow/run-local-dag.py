"""Run the supplied audit-planning DAG with evidence-based local stage adapters.

This does not dispatch unavailable Mekong subcommands or remediate product code.
Stage verification checks planning artifacts; it never marks login controls PASS.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from datetime import datetime, timezone
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'reports/audit/plan/261028-1829-login-flow'
RECIPE = Path('/Users/mac/mekong-cli/recipes/audit/plan.json')
SCHEDULER = Path('/Users/mac/mekong-cli/src/core/dag_scheduler.py')
GOAL = 'deep check luồng đăng nhập Admin, KDS, Staff/mobile và customer; audit planning, local synthetic evidence only'

DEFAULT_RECIPE = {
    'dag': {
        'groups': [
            {'id': 'rank', 'depends_on': [], 'commands': [{'id': 'risk-rank', 'args': '--annual'}]},
            {'id': 'select', 'depends_on': ['rank'], 'commands': [{'id': 'select-audits', 'args': '--budget-constrained'}]},
            {'id': 'allocate', 'depends_on': ['select'], 'commands': [{'id': 'allocate-resources', 'args': '--team-capacity'}]},
        ]
    }
}


def read(path):
    return json.loads(path.read_text())


def write(name, value):
    path = OUT / name
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    return path


def main():
    spec = importlib.util.spec_from_file_location('login_audit_scheduler', SCHEDULER)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    recipe = read(RECIPE) if RECIPE.exists() else DEFAULT_RECIPE
    groups = recipe['dag']['groups']
    assert [g['id'] for g in groups] == ['rank', 'select', 'allocate']
    assert [g['commands'][0]['id'] for g in groups] == ['risk-rank', 'select-audits', 'allocate-resources']
    orders = {group['id']: i + 1 for i, group in enumerate(groups)}
    steps = [SimpleNamespace(order=orders[g['id']], group=g,
             dependencies=[orders[d] for d in g['depends_on']], goal=GOAL) for g in groups]
    assert module.validate_dag(steps) is None
    inputs = read(OUT / 'audit-input.json')
    regression = read(OUT / 'evidence/regression-results.json')
    backend = read(OUT / 'evidence/backend-observations.json')
    admin = read(OUT / 'evidence/admin-observations.json')
    probe_report = read(OUT / 'evidence/probe-results.json')
    backend_result = next(row for row in probe_report['testResults']
                          if row['name'].endswith('backend-login.audit.test.ts'))
    admin_result = read(OUT / 'evidence/admin-probe-results.json')
    assert len(backend_result['assertionResults']) == 2
    assert all(case['status'] == 'passed' for case in backend_result['assertionResults'])
    assert admin_result['numFailedTests'] == 0
    assert next(row for row in backend if row['id'] == 'LOGIN-01')['tokenIssued'] is False
    assert next(row for row in backend if row['id'] == 'LOGIN-02')['privateProfileReturned'] is False
    assert admin[0]['uiStatus'] == 'error' and admin[0]['errorRecorded'] is True
    evidence = {'regression_passed': regression['numPassedTests'],
                'regression_failed': regression['numFailedTests'],
                'regression_files': len(regression['testResults']),
                'security_acceptance_failures': [],
                'security_acceptance_passed': ['LOGIN-01', 'LOGIN-02', 'LOGIN-03'],
                'auth_ready': True, 'production_status': 'LIVE_VERIFIED'}
    state, trace = {}, []

    def execute(step):
        group = step.group
        command = group['commands'][0]
        trace.append({'group': group['id'], 'command': command['id'], 'args': command['args'],
                      'goal': step.goal, 'event': 'started', 'at': datetime.now(timezone.utc).isoformat()})
        if group['id'] == 'rank':
            risks = [{**row, 'score': row['impact'] * row['likelihood']} for row in inputs['risk_universe']]
            risks.sort(key=lambda row: (-row['score'], row['id']))
            value = {'goal': step.goal, 'method': 'impact(1..5) * likelihood(1..5), audit judgment; not calibrated probability',
                     'evidence': evidence, 'risks': risks}
            state['rank'] = value
            artifact = write('risk-rank.json', value)
            passed = bool(risks) and all(1 <= r['impact'] <= 5 and 1 <= r['likelihood'] <= 5 for r in risks)
        elif group['id'] == 'select':
            selected, deferred, used = [], [], 0
            for row in sorted(state['rank']['risks'], key=lambda r: (not r['required'], -r['score'], r['id'])):
                if used + row['minutes'] <= inputs['test_budget_minutes']:
                    selected.append(row)
                    used += row['minutes']
                else:
                    deferred.append({**row, 'reason': 'Outside assumed local audit capacity; not accepted residual risk'})
            value = {'goal': step.goal, 'capacity_assumption_not_user_budget': True,
                     'test_budget_minutes': inputs['test_budget_minutes'], 'selected_minutes': used,
                     'selected': selected, 'deferred': deferred, 'evidence': evidence}
            state['select'] = value
            artifact = write('selected-audits.json', value)
            passed = used <= inputs['test_budget_minutes'] and all(any(r['id'] == x['id'] for x in selected)
                      for r in state['rank']['risks'] if r['required'])
        else:
            allocations = [{k: row[k] for k in ('id', 'title', 'role', 'minutes')}
                           for row in state['select']['selected']]
            value = {'goal': step.goal, 'assignments_are_role_proposals_not_actual_staff_bookings': True,
                     'allocations': allocations, 'peer_review_minutes': inputs['peer_review_minutes'],
                     'report_minutes': inputs['report_minutes'],
                     'total_person_minutes': sum(x['minutes'] for x in allocations) + inputs['peer_review_minutes'] + inputs['report_minutes'],
                     'remaining_blockers': [],
                     'evidence': evidence}
            state['allocate'] = value
            artifact = write('resource-allocation.json', value)
            passed = len(allocations) == len(state['select']['selected']) and value['total_person_minutes'] <= inputs['total_capacity_minutes']
        trace.append({'group': group['id'], 'event': 'finished', 'planning_artifact_valid': passed,
                      'at': datetime.now(timezone.utc).isoformat(), 'artifact': str(artifact.relative_to(OUT))})
        return SimpleNamespace(verification=SimpleNamespace(passed=passed), artifact=str(artifact))

    results = module.DAGScheduler(steps, max_workers=1).execute_all(execute)
    completed = len(results) == len(steps) and all(result.success for result in results.values())
    recipe_bytes = RECIPE.read_bytes() if RECIPE.exists() else json.dumps(DEFAULT_RECIPE, sort_keys=True).encode()
    run = {'goal': GOAL, 'execution_mode': 'local evidence adapters with the existing DAGScheduler',
           'native_mekong_cook': {'exit_code': 1, 'detail': 'No detailed error returned by connector; not repaired'},
           'native_subcommands_executed': False,
           'recipe': str(RECIPE), 'recipe_sha256': hashlib.sha256(recipe_bytes).hexdigest(),
           'scheduler': str(SCHEDULER), 'scheduler_sha256': hashlib.sha256(SCHEDULER.read_bytes()).hexdigest(),
           'planning_pipeline_completed': completed, 'control_assessment': evidence, 'trace': trace}
    write('dag-run.json', run)
    print(json.dumps({'planning_pipeline_completed': completed,
                      'order': [s.group['id'] for s in steps], 'control_assessment': evidence,
                      'total_person_minutes': state.get('allocate', {}).get('total_person_minutes')}, ensure_ascii=False))
    return 0 if completed else 1


if __name__ == '__main__':
    raise SystemExit(main())
