using System.Globalization;
using GpssStudio.Simulation.Runtime;

namespace GpssStudio.Simulation.Reporting;

/// <summary>Builds the GPSS World standard report and chart data from the engine state.</summary>
public static class StandardReportBuilder
{
    private const int MaxChartPoints = 400;

    private static string N(double value) => value.ToString("0.000", CultureInfo.InvariantCulture);
    private static string I(double value) => value.ToString("0", CultureInfo.InvariantCulture);

    public static SimulationReport Build(SimulationEngine engine, string modelName)
    {
        var clock = engine.AbsoluteClock;
        var elapsed = engine.RelativeClock;
        var facilities = engine.Facilities.OrderBy(item => item.Number).ToList();
        var queues = engine.Queues.OrderBy(item => item.Number).ToList();
        var storages = engine.Storages.OrderBy(item => item.Number).ToList();

        var sections = new List<ReportSection>
        {
            new()
            {
                Id = "general",
                Label = "Общая информация",
                Columns = ["Начальное время", "Конечное время", "Кол-во блоков", "Кол-во устройств", "Кол-во мн.канал. устройств"],
                Rows = [[N(engine.StatisticsStartTime), N(clock), I(engine.Blocks.Count), I(facilities.Count), I(storages.Count)]],
            },
            new()
            {
                Id = "names",
                Label = "Имена",
                Columns = ["Имя", "Значение"],
                Rows = engine.Model.Labels.Select(pair => (pair.Key, Value: (double)pair.Value))
                    .Concat(engine.EntityNumbers.Where(pair => !engine.Model.Labels.ContainsKey(pair.Key) && pair.Value >= 10000).Select(pair => (pair.Key, Value: (double)pair.Value)))
                    .Concat(engine.Model.Constants.Select(pair => (pair.Key, pair.Value)))
                    .OrderBy(pair => pair.Key, StringComparer.OrdinalIgnoreCase)
                    .Select(pair => (IReadOnlyList<string>)[pair.Key, N(pair.Value)])
                    .ToList(),
            },
            new()
            {
                Id = "blocks",
                Label = "Блоки",
                Columns = ["Метка", "Позиция блока", "Тип блока", "Кол-во тран. вошедших в блок", "Кол-во тран. в блоке в конце моделирования", "Кол-во тран. ожидающих выполнения спец. условия"],
                Rows = engine.Blocks.Select(block => (IReadOnlyList<string>)
                    [block.Label ?? string.Empty, I(block.Number), block.Operation, I(block.EntryCount), I(block.CurrentCount), I(engine.RetryChain.Count(transaction => transaction.NextBlock == block.Number))]).ToList(),
            },
            new()
            {
                Id = "facilities",
                Label = "Устройства",
                Columns =
                [
                    "Имя / номер", "Кол-во раз, когда устройство было занято", "Коэффициент использования", "Ср. время занятия устройства одним тран.",
                    "Состояние устройства в конце моделирования", "Номер тран., занимающего устройство", "Кол-во тран., ожидающих выполнения с прерыванием других тран.",
                    "Кол-во прерванных тран.", "Кол-во тран., ожидающих выполнения спец. условия", "Кол-во тран. ожидающих занятия устройства",
                ],
                Rows = facilities.Select(facility =>
                {
                    var utilization = facility.Busy.Average(clock, facility.IsBusy ? 1 : 0);
                    return (IReadOnlyList<string>)
                    [
                        facility.Name, I(facility.Entries), N(utilization), N(facility.Entries > 0 ? utilization * elapsed / facility.Entries : 0),
                        facility.Available ? "1" : "0", facility.Owner is null ? "0" : I(facility.Owner.Number), "0", I(facility.InterruptChain.Count), "0", I(facility.DelayChain.Count),
                    ];
                }).ToList(),
            },
            new()
            {
                Id = "queues",
                Label = "Очереди",
                Columns =
                [
                    "Имя / номер", "Макс. содержимое очереди за период моделирования", "Текущее содержимое очереди", "Общее кол-во входов тран. в очередь",
                    "Общее кол-во входов тран. в очередь с нулевым временем ожидания", "Ср. значение содержимого очереди", "Ср. время пребывания одного транзакта в очереди",
                    "Ср. время пребывания одного транзакта очереди без учета нулевых входов", "Кол-во тран., ожидающих выполнения спец. условия",
                ],
                Rows = queues.Select(queue =>
                {
                    var nonZero = queue.Entries - queue.ZeroEntries;
                    return (IReadOnlyList<string>)
                    [
                        queue.Name, I(queue.MaxContent), I(queue.Content), I(queue.Entries), I(queue.ZeroEntries),
                        N(queue.ContentIntegral.Average(clock, queue.Content)), N(queue.Entries > 0 ? queue.TotalTime / queue.Entries : 0),
                        N(nonZero > 0 ? queue.TotalTime / nonZero : 0), "0",
                    ];
                }).ToList(),
            },
            new()
            {
                Id = "storages",
                Label = "Многоканальные устройства",
                Columns =
                [
                    "Имя / номер", "Емкость памяти", "Число свободных единиц памяти к концу моделирования", "Мин. число единиц памяти за период моделирования",
                    "Макс. число единиц памяти за период моделирования", "Кол-во входов в память", "Состояние памяти в конце моделирования", "Ср. значение занятой емкости",
                    "Коэффициент использования памяти", "Кол-во тран., ожидающих выполнения спец. условия", "Кол-во тран. ожидающих в блоках ENTER",
                ],
                Rows = storages.Select(storage =>
                {
                    var average = storage.UsedIntegral.Average(clock, storage.Used);
                    return (IReadOnlyList<string>)
                    [
                        storage.Name, I(storage.Capacity), I(storage.Remaining), I(storage.MinUsed), I(storage.MaxUsed), I(storage.Entries),
                        storage.Available ? "1" : "0", N(average), N(storage.Capacity > 0 ? average / storage.Capacity : 0), "0", I(storage.DelayChain.Count),
                    ];
                }).ToList(),
            },
            new()
            {
                Id = "switches",
                Label = "Логические переключатели",
                Columns = ["Имя / номер", "Значение ключа в конце моделирования", "Кол-во тран., ожидающих выполнения спец. условия"],
                Rows = engine.LogicSwitches.OrderBy(item => item.Number).Select(item => (IReadOnlyList<string>)[item.Name, item.IsSet ? "1" : "0", "0"]).ToList(),
            },
            new()
            {
                Id = "savevalues",
                Label = "Сохраняемые величины",
                Columns = ["Имя / номер", "Кол-во тран. ожидающих выполнения спец. условия", "Значение сохраняемой величины в конце моделирования"],
                Rows = engine.Savevalues.OrderBy(item => item.Number).Select(item => (IReadOnlyList<string>)[item.Name, "0", N(item.Value)]).ToList(),
            },
            new()
            {
                Id = "future",
                Label = "Будущие события",
                Columns =
                [
                    "Номер транзакта", "Приоритет транзакта", "Время выхода из блока", "Номер семейства транзакта",
                    "Номер блока, в котором находился транзакт в конце моделирования", "Номер след. блока", "Имя / номер параметра транзакта", "Значение параметра",
                ],
                Rows = engine.FutureEvents.Select(transaction =>
                {
                    var parameter = transaction.Parameters.FirstOrDefault();
                    return (IReadOnlyList<string>)
                    [
                        I(transaction.Number), I(transaction.Priority), N(transaction.MoveTime), I(transaction.AssemblySet),
                        I(transaction.CurrentBlock), I(transaction.NextBlock), parameter.Key ?? string.Empty, parameter.Key is null ? string.Empty : N(parameter.Value),
                    ];
                }).ToList(),
            },
        };

        if (engine.Tables.Count > 0)
        {
            sections.Add(new ReportSection
            {
                Id = "tables",
                Label = "Таблицы",
                Columns = ["Имя", "Среднее", "Ст. отклонение", "Нижняя граница", "Верхняя граница", "Частота", "Кумулятивный %"],
                Rows = engine.Tables.OrderBy(table => table.Number).SelectMany(TableRows).ToList(),
            });
        }

        return new SimulationReport
        {
            ModelName = modelName,
            CreatedAt = DateTimeOffset.UtcNow,
            StartTime = engine.StatisticsStartTime,
            EndTime = clock,
            Sections = sections,
            Charts = BuildCharts(engine, facilities, queues, storages),
        };
    }

    private static IEnumerable<IReadOnlyList<string>> TableRows(TableEntity table)
    {
        double cumulative = 0;
        for (var index = 0; index < table.Classes; index++)
        {
            if (table.Frequencies[index] == 0)
            {
                continue;
            }

            cumulative += table.Frequencies[index];
            var (lower, upper) = ClassBounds(table, index);
            yield return
            [
                table.Name, N(table.Mean), N(table.StandardDeviation), lower, upper, I(table.Frequencies[index]),
                N(table.WeightedCount > 0 ? cumulative * 100 / table.WeightedCount : 0),
            ];
        }
    }

    private static (string Lower, string Upper) ClassBounds(TableEntity table, int index)
    {
        if (index == 0)
        {
            return ("-", N(table.FirstUpperLimit));
        }

        var lower = table.FirstUpperLimit + (index - 1) * table.Width;
        return index == table.Classes - 1 ? (N(lower), "-") : (N(lower), N(lower + table.Width));
    }

    private static SimulationCharts BuildCharts(SimulationEngine engine, List<Facility> facilities, List<QueueEntity> queues, List<Storage> storages)
    {
        var clock = engine.AbsoluteClock;
        var series = engine.Series.Series
            .Where(pair => !pair.Key.StartsWith("F:", StringComparison.Ordinal))
            .Select(pair => new ChartSeries(pair.Key.StartsWith("Q:", StringComparison.Ordinal) ? "queue" : "storage", pair.Key[2..], Downsample(pair.Value, clock)))
            .OrderBy(item => item.Kind).ThenBy(item => item.Name)
            .ToList();

        return new SimulationCharts
        {
            TimeSeries = series,
            FacilityUtilization = facilities.Select(facility => new ChartBar(facility.Name, Math.Round(facility.Busy.Average(clock, facility.IsBusy ? 1 : 0), 4))).ToList(),
            QueueAverageContent = queues.Select(queue => new ChartBar(queue.Name, Math.Round(queue.ContentIntegral.Average(clock, queue.Content), 4))).ToList(),
            QueueAverageTime = queues.Select(queue => new ChartBar(queue.Name, Math.Round(queue.Entries > 0 ? queue.TotalTime / queue.Entries : 0, 4))).ToList(),
            StorageUtilization = storages.Select(storage => new ChartBar(storage.Name, Math.Round(storage.Capacity > 0 ? storage.UsedIntegral.Average(clock, storage.Used) / storage.Capacity : 0, 4))).ToList(),
            BlockEntries = engine.Blocks.Select(block => new ChartBar($"{block.Number} {block.Operation}", block.EntryCount)).ToList(),
            Tables = engine.Tables.OrderBy(table => table.Number).Select(table => new TableHistogram(
                table.Name,
                Math.Round(table.Mean, 4),
                Math.Round(table.StandardDeviation, 4),
                table.WeightedCount,
                Enumerable.Range(0, table.Classes).Select(index =>
                {
                    var (lower, upper) = ClassBounds(table, index);
                    return new HistogramBin(index == 0 ? $"≤ {upper}" : upper == "-" ? $"> {lower}" : $"{lower}–{upper}", table.Frequencies[index]);
                }).ToList())).ToList(),
        };
    }

    /// <summary>Keeps at most <see cref="MaxChartPoints"/> points and closes the step line at the current clock.</summary>
    private static IReadOnlyList<double[]> Downsample(List<SeriesPoint> points, double clock)
    {
        var step = Math.Max(1, (int)Math.Ceiling(points.Count / (double)MaxChartPoints));
        var result = points.Where((_, index) => index % step == 0).Select(point => new[] { Math.Round(point.Time, 3), point.Value }).ToList();
        if (points.Count > 0)
        {
            var last = points[^1];
            if (result[^1][0] != Math.Round(last.Time, 3))
            {
                result.Add([Math.Round(last.Time, 3), last.Value]);
            }

            if (clock > last.Time)
            {
                result.Add([Math.Round(clock, 3), last.Value]);
            }
        }

        return result;
    }
}
