import { useState, type ReactNode } from 'react';
import runSimIcon from '../../../../shared/assets/icons/run-sim.png';
import type { SimulationCharts, SimulationReport } from '../../../../shared/types/simulation';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { useTebEditorStore } from '../../store/useTebEditorStore';
import { BarsChart, ChartCard, HistogramChart, StepSeriesChart } from './ChartCards';
import { formatNumber } from './chartTheme';
import '../StandardReportDocument/StandardReportDocument.css';
import './SimulationChartsDocument.css';

type ChartSectionId = 'facilities' | 'queues' | 'queue-dynamics' | 'storages' | 'tables' | 'blocks';

interface ChartSection {
  id: ChartSectionId;
  label: string;
  isAvailable: (charts: SimulationCharts) => boolean;
  render: (charts: SimulationCharts, report: SimulationReport) => ReactNode;
}

const SECTIONS: ChartSection[] = [
  {
    id: 'facilities',
    label: 'Загрузка устройств',
    isAvailable: (charts) => charts.FacilityUtilization.length > 0,
    render: (charts) => (
      <ChartCard title="Коэффициент использования устройств" subtitle="Доля модельного времени, когда устройство занято (0–1)">
        <BarsChart data={charts.FacilityUtilization} valueLabel="Коэффициент использования" domainMax={1} />
      </ChartCard>
    ),
  },
  {
    id: 'queues',
    label: 'Очереди',
    isAvailable: (charts) => charts.QueueAverageContent.length > 0,
    render: (charts) => (
      <>
        <ChartCard title="Средняя длина очереди" subtitle="Среднее по времени число транзактов в очереди">
          <BarsChart data={charts.QueueAverageContent} valueLabel="Средняя длина" />
        </ChartCard>
        <ChartCard title="Среднее время пребывания в очереди" subtitle="Модельные единицы времени на один транзакт">
          <BarsChart data={charts.QueueAverageTime} valueLabel="Среднее время" />
        </ChartCard>
      </>
    ),
  },
  {
    id: 'queue-dynamics',
    label: 'Динамика очередей и памяти',
    isAvailable: (charts) => charts.TimeSeries.length > 0,
    render: (charts, report) => (
      <div className="chart-grid">
        {charts.TimeSeries.map((series) => (
          <ChartCard
            key={`${series.Kind}-${series.Name}`}
            title={series.Name}
            subtitle={series.Kind === 'queue' ? 'Длина очереди во времени' : 'Занято единиц памяти во времени'}
            height={170}
          >
            <StepSeriesChart
              series={series}
              valueLabel={series.Kind === 'queue' ? 'Длина очереди' : 'Занято'}
              startTime={report.StartTime}
              endTime={report.EndTime}
            />
          </ChartCard>
        ))}
      </div>
    ),
  },
  {
    id: 'storages',
    label: 'Многоканальные устройства',
    isAvailable: (charts) => charts.StorageUtilization.length > 0,
    render: (charts) => (
      <ChartCard title="Коэффициент использования памяти" subtitle="Средняя занятая ёмкость, отнесённая к полной (0–1)">
        <BarsChart data={charts.StorageUtilization} valueLabel="Коэффициент использования" domainMax={1} />
      </ChartCard>
    ),
  },
  {
    id: 'tables',
    label: 'Таблицы (гистограммы)',
    isAvailable: (charts) => charts.Tables.length > 0,
    render: (charts) => (
      <>
        {charts.Tables.map((table) => (
          <ChartCard
            key={table.Name}
            title={`Таблица ${table.Name}`}
            subtitle={`Наблюдений: ${formatNumber(table.Count, 0)}, среднее ${formatNumber(table.Mean)}, ст. отклонение ${formatNumber(table.StandardDeviation)}`}
          >
            <HistogramChart table={table} />
          </ChartCard>
        ))}
      </>
    ),
  },
  {
    id: 'blocks',
    label: 'Входы в блоки',
    isAvailable: (charts) => charts.BlockEntries.length > 0,
    render: (charts) => (
      <ChartCard title="Число входов транзактов в блоки" height={Math.max(240, charts.BlockEntries.length * 18)}>
        <BarsChart data={charts.BlockEntries} valueLabel="Входов" horizontal />
      </ChartCard>
    ),
  },
];

/** Charts of the last simulation run (utilisation, queues, dynamics, histograms). */
export function SimulationChartsDocument() {
  const report = useTebEditorStore((state) => state.simulationReport);
  const simulationBusy = useTebEditorStore((state) => state.simulationBusy);
  const startSimulation = useTebEditorStore((state) => state.startSimulation);
  const activateDocument = useTebEditorStore((state) => state.activateDocument);
  const [activeSectionId, setActiveSectionId] = useState<ChartSectionId>('facilities');

  if (!report) {
    return (
      <section className="simulation-charts simulation-charts--empty">
        <p>Графики строятся по результатам моделирования. Запустите модель, чтобы увидеть загрузку устройств, очереди и их динамику.</p>
        <IconButton
          icon={runSimIcon}
          label="Запустить моделирование"
          title="Запустить моделирование"
          disabled={simulationBusy}
          onClick={() => void startSimulation()}
        />
      </section>
    );
  }

  const sections = SECTIONS.filter((section) => section.isAvailable(report.Charts));
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];

  return (
    <section className="standard-report-document simulation-charts" aria-label="Графики результатов моделирования">
      <aside className="standard-report-nav" aria-label="Разделы графиков">
        <div className="standard-report-nav__title">Графики: {report.ModelName}</div>
        {sections.map((section) => (
          <button
            className={`standard-report-nav__item ${activeSection?.id === section.id ? 'is-active' : ''}`}
            key={section.id}
            type="button"
            aria-current={activeSection?.id === section.id}
            onClick={() => setActiveSectionId(section.id)}
          >
            {section.label}
          </button>
        ))}
        <button className="standard-report-nav__item simulation-charts__table-link" type="button" onClick={() => activateDocument('std-report')}>
          Таблицы стандартного отчёта →
        </button>
      </aside>

      <div className="simulation-charts__content">
        <div className="simulation-charts__meta">
          Модельное время {formatNumber(report.StartTime)} – {formatNumber(report.EndTime)}
        </div>
        {activeSection ? activeSection.render(report.Charts, report) : <p>В модели нет объектов для построения графиков.</p>}
      </div>
    </section>
  );
}
