/**
 * FlynnSim - MISD Studio Controller (misd.html)
 * 
 * Drives the dedicated MISD Studio with Systolic Stream Pipeline
 * and Space Shuttle TMR Fault-Tolerant Voting with interactive fault injection.
 */

document.addEventListener('DOMContentLoaded', () => {
    let arch = new MISDArchitecture(3);
    let currentWorkload = null;
    let isRunning = false;
    let clockTimer = null;
    let clockHz = 3;

    const selectMode = document.getElementById('select-misd-mode');
    const btnInjectFault = document.getElementById('btn-inject-fault');
    const btnStep = document.getElementById('btn-step');
    const btnRun = document.getElementById('btn-run');
    const btnFast = document.getElementById('btn-fast');
    const btnReset = document.getElementById('btn-reset');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');

    const metricCycles = document.getElementById('metric-cycles');
    const metricTokens = document.getElementById('metric-tokens');
    const metricUtil = document.getElementById('metric-util');
    const statusBadge = document.getElementById('status-badge');

    const traceText = document.getElementById('live-trace-text');
    const schematicContainer = document.getElementById('misd-schematic-box');
    const outputHistoryContainer = document.getElementById('misd-output-history');

    function loadWorkload(mode) {
        pause();
        if (mode === 'PIPELINE') {
            currentWorkload = WorkloadManager.createStreamPipelineWorkload(8);
            if (btnInjectFault) btnInjectFault.style.display = 'none';
        } else {
            currentWorkload = WorkloadManager.createFaultTolerantVotingWorkload(6);
            if (btnInjectFault) btnInjectFault.style.display = 'inline-flex';
        }
        arch.loadWorkload(currentWorkload);
        render();
    }

    function render() {
        const m = arch.getMetrics(arch.clockCycle);

        if (metricCycles) metricCycles.textContent = m.cycles;
        if (metricTokens) metricTokens.textContent = `${arch.streamPointer}/${arch.inputStream.length}`;
        if (metricUtil) metricUtil.textContent = `${m.utilization}%`;

        if (statusBadge) {
            statusBadge.className = `arch-status-badge status-${arch.isHalted ? 'halted' : (arch.clockCycle > 0 ? 'running' : 'idle')}`;
            statusBadge.textContent = arch.isHalted ? 'HALTED' : (arch.clockCycle > 0 ? 'RUNNING' : 'IDLE');
        }

        if (traceText) traceText.textContent = arch.currentTrace || 'Cycle 0: MISD stream ready.';

        if (schematicContainer) {
            if (arch.mode === 'PIPELINE') {
                renderPipelineSchematic();
            } else {
                renderVotingSchematic();
            }
        }

        if (outputHistoryContainer) {
            renderOutputHistory();
        }
    }

    function renderPipelineSchematic() {
        let stagesHTML = '';
        arch.pes.forEach((pe, idx) => {
            const bufVal = arch.pipelineBuffers[idx];
            const stageName = idx === 0 ? 'Stage 0: Offset (-5)' : idx === 1 ? 'Stage 1: Gain (*3)' : 'Stage 2: Clamp [0..100]';
            stagesHTML += `
            <div class="misd-stage-column" style="flex:1;">
                <div class="hardware-block cu-mini pulse-amber">
                    <div class="mini-title">CU ${idx}</div>
                    <div class="mini-prog">PC: ${pe.PC}</div>
                </div>
                <div class="stream-line-vert line-instruction" style="height:16px;"></div>
                <div class="hardware-block pe-block state-${pe.state.toLowerCase()}" style="width:100%;">
                    <div class="block-title">PE ${idx}</div>
                    <div class="stage-tag" style="font-size:10px; color:var(--c-instr); margin:2px 0;">${stageName}</div>
                    <div class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</div>
                    <div class="node-desc" style="font-size:10px; margin-top:4px;">${pe.lastOpDescription}</div>
                </div>
                <div class="pipeline-buffer ${bufVal !== null ? 'buffer-full' : 'buffer-empty'}" style="margin-top:6px; width:100%; text-align:center;">
                    <span class="buffer-label">Buffer ${idx}:</span>
                    <strong>${bufVal !== null ? bufVal : 'Empty'}</strong>
                </div>
            </div>
            ${idx < arch.peCount - 1 ? '<div class="pipeline-arrow" style="font-size:24px; padding:0 8px;">➔</div>' : ''}
            `;
        });

        schematicContainer.innerHTML = `
            <div class="arch-schematic misd-schematic">
                <div class="legend-bar">
                    <span class="legend-item"><span class="legend-dot dot-instr"></span> 3 Specialized Instruction Streams</span>
                    <span class="legend-item"><span class="legend-dot dot-data"></span> 1 Sequential Data Stream (Systolic Flow)</span>
                    <span class="badge-systolic">DSP Stream Pipeline</span>
                </div>
                <div style="margin: 12px 0; background:var(--c-bg); border:1px solid var(--c-border); padding:8px 12px; border-radius:6px; font-family:var(--font-mono); font-size:12px;">
                    Input Stream Queue: <strong>[${arch.inputStream.slice(arch.streamPointer).join(', ') || 'Stream Drained'}]</strong>
                </div>
                <div class="misd-stages-flex" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                    ${stagesHTML}
                </div>
            </div>
        `;
    }

    function renderVotingSchematic() {
        let peVotingHTML = '';
        arch.pes.forEach((pe, idx) => {
            const isFaulty = arch.faultInjectedPE === idx;
            peVotingHTML += `
            <div class="tmr-pe-branch" style="flex:1; text-align:center; background:var(--c-surface); padding:10px; border-radius:8px; border:1px ${isFaulty ? 'dashed var(--c-instr)' : 'solid var(--c-border)'};">
                <div class="hardware-block cu-mini pulse-amber" style="margin:0 auto 8px auto;">
                    <div class="mini-title">CU ${idx}</div>
                    <div class="mini-algo" style="font-size:10px;">Algorithm ${String.fromCharCode(65 + idx)}</div>
                </div>
                <div class="hardware-block pe-block state-${pe.state.toLowerCase()}">
                    <div class="block-title">Core ${pe.id}</div>
                    <div class="tmr-out-val" style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:${isFaulty ? 'var(--c-text-muted)' : 'var(--c-data)'}; margin:4px 0;">
                        Out: ${pe.registers.R0}
                    </div>
                    ${isFaulty ? '<span class="fault-badge" style="background:var(--c-surface); color:var(--c-text-muted); border:1px solid var(--c-border); font-size:9px; padding:2px 6px; border-radius:3px; font-weight:700;">FAULT (MASKED)</span>' : '<span style="font-size:9px; color:var(--c-text-muted);">Normal Operation</span>'}
                </div>
            </div>
            `;
        });

        const lastVote = arch.votingResults[arch.votingResults.length - 1];
        const consensusText = lastVote ? `Consensus: ${lastVote.consensus}` : 'Awaiting Data...';

        schematicContainer.innerHTML = `
            <div class="arch-schematic misd-schematic">
                <div class="legend-bar">
                    <span class="legend-item"><span class="legend-dot dot-instr"></span> 3 Diverse Instruction Streams</span>
                    <span class="legend-item"><span class="legend-dot dot-data"></span> 1 Broadcast Sensor Stream</span>
                    <span class="badge-tmr">Space Shuttle TMR Model</span>
                </div>
                <div style="margin:10px 0; text-align:center; background:var(--c-bg); border:1px solid var(--c-border); padding:8px; border-radius:6px; font-size:13px;">
                    📡 Broadcast Sensor Token: <strong style="font-size:16px; color:var(--c-data);">${arch.streamPointer > 0 ? arch.inputStream[arch.streamPointer - 1] : arch.inputStream[0]}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; gap:16px; margin:12px 0;">
                    ${peVotingHTML}
                </div>
                <div class="hardware-voter-box ${lastVote && lastVote.faultyPE !== null ? 'voter-fault-detected' : 'voter-normal'}" style="margin-top:14px;">
                    <div class="voter-icon" style="font-size:24px;">⚖️</div>
                    <div class="voter-title">2-out-of-3 Hardware Majority Voter</div>
                    <div class="voter-result" style="font-size:18px; margin:6px 0;">${consensusText}</div>
                    ${lastVote && lastVote.faultyPE !== null ? 
                        `<div class="voter-alert">⚠️ Fault on PE ${lastVote.faultyPE} successfully masked by majority vote! Correct consensus guaranteed.</div>` : 
                        `<div class="voter-ok">✓ Unanimous Hardware Consensus</div>`}
                </div>
            </div>
        `;
    }

    function renderOutputHistory() {
        if (arch.mode === 'FAULT_TOLERANT_VOTING') {
            outputHistoryContainer.innerHTML = arch.votingResults.map(vr => `
                <div style="display:flex; justify-content:space-between; padding:6px 10px; border-bottom:1px solid var(--c-border); font-family:var(--font-mono); font-size:11px;">
                    <span>Input: <strong>${vr.input}</strong></span>
                    <span>Outputs: [${vr.outputs.join(', ')}]</span>
                    <span style="color:var(--c-data); font-weight:700;">Consensus: ${vr.consensus}</span>
                    <span style="color:${vr.faultyPE !== null ? 'var(--c-instr)' : 'var(--c-text-muted)'};">${vr.faultyPE !== null ? `Masked Fault on PE ${vr.faultyPE}` : 'OK'}</span>
                </div>
            `).join('') || '<div style="color:var(--c-text-muted); padding:8px;">No voting records yet. Step or Run simulation.</div>';
        } else {
            const outCount = arch.memory.read(200) || 0;
            const outs = [];
            for (let i = 0; i < outCount; i++) {
                outs.push(arch.memory.read(201 + i));
            }
            outputHistoryContainer.innerHTML = `
                <div style="padding:8px; font-family:var(--font-mono); font-size:12px;">
                    Stream Output Tokens in Memory: <strong>[${outs.join(', ') || 'Waiting for pipeline to drain...'}]</strong>
                </div>
            `;
        }
    }

    function step() {
        if (!arch.isHalted) {
            arch.step();
            render();
        } else {
            pause();
        }
    }

    function run() {
        if (isRunning) return;
        isRunning = true;
        updateRunButton();
        clockTimer = setInterval(() => {
            if (!arch.isHalted) {
                arch.step();
                render();
            } else {
                pause();
            }
        }, Math.floor(1000 / clockHz));
    }

    function pause() {
        isRunning = false;
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
        }
        updateRunButton();
    }

    function updateRunButton() {
        if (btnRun) {
            btnRun.innerHTML = isRunning ? '<span>PAUSE</span>' : '<span>RUN</span>';
            btnRun.className = isRunning ? 'control-btn btn-warning' : 'control-btn btn-success';
        }
    }

    function runFast() {
        pause();
        let max = 5000;
        while (!arch.isHalted && max > 0) {
            arch.step();
            max--;
        }
        render();
    }

    if (btnStep) btnStep.addEventListener('click', step);
    if (btnRun) btnRun.addEventListener('click', () => isRunning ? pause() : run());
    if (btnFast) btnFast.addEventListener('click', runFast);
    if (btnReset) btnReset.addEventListener('click', () => loadWorkload(selectMode.value));

    if (selectMode) {
        selectMode.addEventListener('change', (e) => loadWorkload(e.target.value));
    }

    if (btnInjectFault) {
        btnInjectFault.addEventListener('click', () => {
            if (arch.faultInjectedPE === 1) {
                arch.injectFault(-1);
                btnInjectFault.textContent = '⚡ Inject Fault on PE 1';
                btnInjectFault.classList.remove('btn-danger-active');
            } else {
                arch.injectFault(1);
                btnInjectFault.textContent = '❌ Fault Injected on PE 1 (Active)';
                btnInjectFault.classList.add('btn-danger-active');
            }
            render();
        });
    }

    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            clockHz = parseInt(e.target.value, 10);
            if (speedValue) speedValue.textContent = `${clockHz} Hz`;
            if (isRunning) {
                pause();
                run();
            }
        });
    }

    loadWorkload('PIPELINE');
});
