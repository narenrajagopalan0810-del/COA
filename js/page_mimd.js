/**
 * FlynnSim - MIMD Studio Controller (mimd.html)
 * 
 * Drives the dedicated MIMD Studio featuring:
 * - Shared Memory Bus (SMP) with Round-Robin arbitration and contention stall tracking
 * - Distributed Memory (Cluster) with private address spaces
 * - Autonomous multi-core program counters and independent instruction streams
 */

document.addEventListener('DOMContentLoaded', () => {
    let peCount = 4;
    let arch = new MIMDArchitecture(peCount);
    let currentWorkload = null;
    let isRunning = false;
    let clockTimer = null;
    let clockHz = 4;

    const selectWorkload = document.getElementById('select-workload');
    const selectPeCount = document.getElementById('select-pe-count');
    const selectMemModel = document.getElementById('select-mem-model');
    const btnStep = document.getElementById('btn-step');
    const btnRun = document.getElementById('btn-run');
    const btnFast = document.getElementById('btn-fast');
    const btnReset = document.getElementById('btn-reset');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');

    const metricCycles = document.getElementById('metric-cycles');
    const metricInstrs = document.getElementById('metric-instrs');
    const metricUtil = document.getElementById('metric-util');
    const metricContention = document.getElementById('metric-contention');
    const statusBadge = document.getElementById('status-badge');

    const traceText = document.getElementById('live-trace-text');
    const schematicContainer = document.getElementById('mimd-schematic-box');
    const coresGridContainer = document.getElementById('mimd-cores-grid');

    function loadWorkload(type) {
        pause();
        if (type === 'vector_addition') {
            currentWorkload = WorkloadManager.createVectorAdditionWorkload(8, peCount);
        } else if (type === 'matrix_mult') {
            currentWorkload = WorkloadManager.createMatrixMultiplicationWorkload(2, peCount);
        } else if (type === 'conditional_filter') {
            currentWorkload = WorkloadManager.createConditionalFilterWorkload(8, peCount);
        }

        arch.setPECount(peCount);
        arch.loadWorkload(currentWorkload);
        render();
    }

    function render() {
        const m = arch.getMetrics(arch.clockCycle);

        if (metricCycles) metricCycles.textContent = m.cycles;
        if (metricInstrs) metricInstrs.textContent = m.instructions;
        if (metricUtil) metricUtil.textContent = `${m.utilization}%`;
        if (metricContention) metricContention.textContent = `${arch.totalContentionStalls} cycles`;

        if (statusBadge) {
            statusBadge.className = `arch-status-badge status-${arch.isHalted ? 'halted' : (arch.clockCycle > 0 ? 'running' : 'idle')}`;
            statusBadge.textContent = arch.isHalted ? 'HALTED' : (arch.clockCycle > 0 ? 'RUNNING' : 'IDLE');
        }

        if (traceText) traceText.textContent = arch.currentTrace || 'Cycle 0: MIMD cores ready.';

        const isShared = arch.memoryModel === 'SHARED';

        if (schematicContainer) {
            let coresHTML = '';
            arch.pes.forEach((pe) => {
                const isStalled = pe.state === PEState.STALLED_BUS;
                const isGrantee = isShared && (arch.memory.busGrantee === pe.id);

                coresHTML += `
                <div class="mimd-core-box state-${pe.state.toLowerCase()} ${isGrantee ? 'bus-winner' : ''} ${isStalled ? 'bus-stalled' : ''}">
                    <div class="mimd-core-header">
                        <span class="core-id-badge" style="font-weight:700;">Core ${pe.id}</span>
                        <span class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</span>
                    </div>
                    <div class="core-cu-strip" style="margin:4px 0;">
                        <span>CU ${pe.id}</span>
                        <span style="font-weight:700;">PC: ${pe.PC}</span>
                    </div>
                    <div class="core-instr-tag">
                        <code>${pe.currentInstruction ? pe.currentInstruction.raw : (pe.state === PEState.HALTED ? 'HALT' : 'IDLE')}</code>
                    </div>
                    <div class="core-regs-mini" style="margin:4px 0;">
                        R0:${pe.registers.R0} R1:${pe.registers.R1} R2:${pe.registers.R2}
                    </div>
                    <div class="core-desc-footer" style="font-size:10px;">${pe.lastOpDescription}</div>
                </div>
                `;
            });

            schematicContainer.innerHTML = `
                <div class="arch-schematic mimd-schematic">
                    <div class="legend-bar">
                        <span class="legend-item"><span class="legend-dot dot-instr"></span> ${arch.peCount} Independent Instruction Streams</span>
                        <span class="legend-item"><span class="legend-dot dot-data"></span> ${arch.peCount} Independent Data Streams</span>
                        <span class="badge-memmodel" style="margin-left:auto; font-weight:700; color:var(--c-data);">${isShared ? 'Shared Bus (SMP / UMA)' : 'Distributed Memory (Cluster / NUMA)'}</span>
                    </div>

                    <div class="mimd-cores-grid" style="margin-top:14px;">
                        ${coresHTML}
                    </div>

                    ${isShared ? `
                    <div class="shared-bus-interconnect" style="margin-top:16px;">
                        <div class="bus-arbiter-box ${arch.memory.busBusy ? 'arbiter-active' : ''}">
                            <div class="arbiter-title">⚡ Round-Robin Shared Bus Arbiter</div>
                            <div class="arbiter-status" style="margin:4px 0;">
                                ${arch.memory.busGrantee !== null ? 
                                    `<span class="grantee-pill">Bus Granted to: Core ${arch.memory.busGrantee}</span>` : 
                                    '<span class="bus-free-pill">Bus Free (No contention)</span>'}
                            </div>
                            <div class="contention-counter" style="font-size:11px;">
                                Total Contention Stalls: <strong>${arch.totalContentionStalls} cycles</strong>
                            </div>
                        </div>
                        <div class="shared-memory-module" style="background:var(--c-surface); padding:8px 12px; border-radius:6px; border:1px solid var(--c-border);">
                            <div class="mem-title" style="font-size:11px; font-weight:700; color:var(--c-data);">💾 Shared Central Memory</div>
                            <div class="mem-preview" style="font-size:11px; font-family:var(--font-mono);">Base Output: [${arch.memory.read(90)}, ${arch.memory.read(91)}, ${arch.memory.read(92)}, ...]</div>
                        </div>
                    </div>
                    ` : `
                    <div class="distributed-memory-row" style="margin-top:14px; background:var(--c-bg); border:1px solid var(--c-border); padding:10px; border-radius:8px;">
                        <div style="font-size:12px; font-weight:700; color:var(--c-data); margin-bottom:6px;">Distributed Private Address Spaces (Zero Shared Bus Stalls):</div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px;">
                            ${arch.localMemories.map((lm, i) => `
                                <div style="background:var(--c-surface); border:1px solid var(--c-border); padding:6px; border-radius:4px; font-size:11px; font-family:var(--font-mono);">
                                    <span>Core ${i} Local Mem</span>
                                    <div>[${lm.read(90 + i)}, ...]</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    `}
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
    if (btnReset) btnReset.addEventListener('click', () => loadWorkload(selectWorkload.value));

    if (selectWorkload) {
        selectWorkload.addEventListener('change', (e) => loadWorkload(e.target.value));
    }

    if (selectPeCount) {
        selectPeCount.addEventListener('change', (e) => {
            peCount = parseInt(e.target.value, 10);
            loadWorkload(selectWorkload.value);
        });
    }

    if (selectMemModel) {
        selectMemModel.addEventListener('change', (e) => {
            arch.setMemoryModel(e.target.value);
            loadWorkload(selectWorkload.value);
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

    loadWorkload('vector_addition');
});
