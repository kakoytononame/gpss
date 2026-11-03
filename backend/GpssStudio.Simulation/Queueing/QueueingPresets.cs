namespace GpssStudio.Simulation.Queueing;

/// <summary>A ready-made queueing system of the constructor's catalogue.</summary>
public sealed record QueueingPreset(string Id, string Group, string Title, string Description, QueueingModel Model);

/// <summary>Catalogue of classical queueing systems and networks (also the test suite of the constructor).</summary>
public static class QueueingPresets
{
    private static QueueingRoute To(string target, double probability) => new() { Target = target, Probability = probability };

    private static QueueingModel Single(string name, Distribution arrival, QueueingNode node, double duration = 100_000, double warmUp = 5_000, BatchSize? batch = null) => new()
    {
        Name = name,
        Duration = duration,
        WarmUp = warmUp,
        Replications = 5,
        Classes = [new CustomerClass { Id = "c1", Name = "Заявки", Arrival = arrival, Batch = batch, Entry = node.Id }],
        Nodes = [node],
    };

    private static QueueingNode Station(string name, Distribution service, int servers = 1) => new() { Id = "n1", Name = name, Servers = servers, Service = service };

    public static IReadOnlyList<QueueingPreset> All { get; } =
    [
        // ---------------------------------------------------------------- basic systems
        new("mm1", "Классические системы", "M/M/1 — касса", "Пуассоновский поток (интервал 10), экспоненциальное обслуживание (8), один канал: ρ = 0,8.",
            Single("M/M/1", Distribution.Exponential(10), Station("Касса", Distribution.Exponential(8)))),
        new("mmc", "Классические системы", "M/M/3 — колл-центр (Эрланг C)", "Три оператора, поток каждые 4 мин, разговор 10 мин: ρ = 0,83.",
            Single("M/M/3", Distribution.Exponential(4), Station("Операторы", Distribution.Exponential(10), 3))),
        new("mmck", "Классические системы", "M/M/2/5 — ограниченная очередь", "Два канала и три места ожидания: заявка, заставшая 5 заявок, получает отказ.",
            Single("M/M/2/5", Distribution.Exponential(3), Station("Мастерская", Distribution.Exponential(5), 2) with { Capacity = 5 })),
        new("erlang-b", "Классические системы", "M/G/4/4 — система с отказами (Эрланг B)", "Четыре линии без очереди, логнормальная длительность: вероятность отказа не зависит от распределения.",
            Single("M/G/4/4", Distribution.Exponential(2), new QueueingNode { Id = "n1", Name = "Линии связи", Servers = 4, Capacity = 4, Service = Distribution.LogNormal(5, 1.5) })),
        new("md1", "Классические системы", "M/D/1 — автомат с постоянным временем", "Детерминированное обслуживание: очередь вдвое короче, чем в M/M/1.",
            Single("M/D/1", Distribution.Exponential(10), Station("Автомат", Distribution.Deterministic(8)))),
        new("mek1", "Классические системы", "M/E3/1 — обслуживание Эрланга", "Обслуживание из трёх экспоненциальных фаз (коэффициент вариации 0,58).",
            Single("M/E3/1", Distribution.Exponential(10), Station("Станок", Distribution.Erlang(8, 3)))),
        new("mh2", "Классические системы", "M/H2/1 — сильно изменчивое обслуживание", "Гиперэкспоненциальное время (коэффициент вариации 2): очередь в 2,5 раза длиннее, чем в M/M/1.",
            Single("M/H2/1", Distribution.Exponential(10), Station("Сервер", Distribution.HyperExponential(7, 2)), duration: 180_000, warmUp: 9_000)),
        new("gim1", "Классические системы", "E2/M/1 — регулярный поток", "Поток Эрланга 2-го порядка (GI/M/1): точное решение через корень σ = A*(μ(1−σ)).",
            Single("E2/M/1", Distribution.Erlang(10, 2), Station("Склад", Distribution.Exponential(8)))),
        new("gg1", "Классические системы", "U/LN/1 — общий случай (Кингман)", "Равномерный поток и логнормальное обслуживание: приближённая формула Кингмана.",
            Single("U/LN/1", Distribution.Uniform(4, 16), Station("Обработка", Distribution.LogNormal(8, 0.8)))),
        new("ggc", "Классические системы", "Γ/T/3 — многоканальная (Аллен–Каннен)", "Гамма-поток и треугольное обслуживание, три канала: приближение Аллена–Каннена.",
            Single("Γ/T/3", Distribution.GammaDistribution(4, 0.7), Station("Окна", Distribution.Triangular(5, 9, 16), 3))),
        new("mginf", "Классические системы", "M/G/∞ — самообслуживание", "Неограниченное число каналов (W — среднее время в магазине): L = λ·E[S] для любого распределения.",
            Single("M/G/∞", Distribution.Exponential(2), new QueueingNode { Id = "n1", Name = "Торговый зал", Servers = 0, Service = Distribution.Weibull(30, 2) })),

        // ---------------------------------------------------------------- disciplines
        new("lifo", "Дисциплины обслуживания", "LIFO — последним пришёл, первым обслужен", "Средние показатели совпадают с FIFO, отличается разброс времени ожидания.",
            Single("M/M/1 LIFO", Distribution.Exponential(10), Station("Стопка документов", Distribution.Exponential(8)) with { Discipline = QueueDiscipline.Lifo })),
        new("siro", "Дисциплины обслуживания", "SIRO — случайный выбор из очереди", "Из очереди выбирается случайная заявка; средние те же, что для FIFO.",
            Single("M/E2/2 SIRO", Distribution.Exponential(5), Station("Диспетчер", Distribution.Erlang(8, 2), 2) with { Discipline = QueueDiscipline.Random })),
        new("spt", "Дисциплины обслуживания", "SPT — кратчайшая работа первой", "Первыми обслуживаются короткие задания: среднее ожидание меньше, чем при FIFO.",
            Single("M/H2/1 SPT", Distribution.Exponential(10), Station("Принтер", Distribution.HyperExponential(7, 1.5)) with { Discipline = QueueDiscipline.ShortestJob }, duration: 180_000, warmUp: 9_000)),
        new("round-robin", "Дисциплины обслуживания", "Циклическое обслуживание (≈ PS)", "Процессор выделяет кванты по 0,1: время пребывания пропорционально длине задания, W = E[S]/(1−ρ).",
            Single("M/H2/1 RR", Distribution.Exponential(10), Station("Процессор", Distribution.HyperExponential(6, 1.5)) with { Discipline = QueueDiscipline.RoundRobin, Quantum = 0.1 },
                duration: 40_000, warmUp: 2_000)),
        new("priority", "Дисциплины обслуживания", "Относительный приоритет (Кобхэм)", "Срочные и обычные заказы; срочные выбираются из очереди первыми, начатое обслуживание не прерывается.",
            new QueueingModel
            {
                Name = "M/G/1 с относительным приоритетом",
                Duration = 120_000,
                WarmUp = 6_000,
                Replications = 5,
                Classes =
                [
                    new CustomerClass { Id = "urgent", Name = "Срочные", Arrival = Distribution.Exponential(25), Priority = 2, Entry = "n1" },
                    new CustomerClass { Id = "normal", Name = "Обычные", Arrival = Distribution.Exponential(12), Priority = 1, Entry = "n1",
                        Services = [new ServiceOverride { Node = "n1", Service = Distribution.Erlang(6, 2) }] },
                ],
                Nodes = [new QueueingNode { Id = "n1", Name = "Цех", Discipline = QueueDiscipline.Priority, Service = Distribution.Exponential(5) }],
            }),
        new("preemptive", "Дисциплины обслуживания", "Абсолютный приоритет (с прерыванием)", "Аварийные заявки прерывают плановые; прерванная заявка дообслуживается.",
            new QueueingModel
            {
                Name = "M/M/1 с абсолютным приоритетом",
                Duration = 120_000,
                WarmUp = 6_000,
                Replications = 5,
                Classes =
                [
                    new CustomerClass { Id = "alarm", Name = "Аварийные", Arrival = Distribution.Exponential(20), Priority = 5, Entry = "n1" },
                    new CustomerClass { Id = "plan", Name = "Плановые", Arrival = Distribution.Exponential(10), Priority = 1, Entry = "n1" },
                ],
                Nodes = [new QueueingNode { Id = "n1", Name = "Бригада", Discipline = QueueDiscipline.PreemptivePriority, Service = Distribution.Exponential(5) }],
            }),

        // ---------------------------------------------------------------- customer behaviour
        new("reneging", "Поведение заявок", "M/M/2+M — нетерпеливые клиенты (Эрланг A)", "Клиент уходит, если ждал дольше своего терпения (в среднем 6 мин).",
            Single("M/M/2+M", Distribution.Exponential(2), Station("Окна банка", Distribution.Exponential(4.5), 2) with { Patience = Distribution.Exponential(6) })),
        new("balking", "Поведение заявок", "Отказ от вступления в очередь", "Клиент встаёт в очередь из w человек с вероятностью 1/(w+1).",
            Single("M/M/1 с отказом от очереди", Distribution.Exponential(5), Station("Ларёк", Distribution.Exponential(6)) with { Balking = BalkingKind.Discouraged })),
        new("retrial", "Поведение заявок", "Повторные вызовы (орбита)", "Абонент, заставший линию занятой, перезванивает в среднем через 15 мин.",
            Single("M/M/1 с повторными вызовами", Distribution.Exponential(10), new QueueingNode
            {
                Id = "n1", Name = "Телефонная линия", Servers = 1, Capacity = 1, WhenFull = FullPolicy.Retry, Retrial = Distribution.Exponential(15), Service = Distribution.Exponential(6),
            }, duration: 120_000, warmUp: 6_000)),
        new("batch", "Поведение заявок", "M^X/M/1 — групповые поступления", "Посетители приходят группами по 1–4 человека.",
            Single("M^X/M/1", Distribution.Exponential(20), Station("Гардероб", Distribution.Exponential(5)), batch: new BatchSize { Kind = BatchKind.Uniform, Min = 1, Max = 4 },
                duration: 120_000, warmUp: 6_000)),
        new("finite-source", "Поведение заявок", "Наладчики станков (конечный источник)", "6 станков ломаются в среднем раз в 60 мин, два наладчика ремонтируют по 15 мин.",
            new QueueingModel
            {
                Name = "M/M/2//6",
                Duration = 120_000,
                WarmUp = 6_000,
                Replications = 5,
                Classes = [new CustomerClass { Id = "machines", Name = "Станки", Kind = CustomerClassKind.Closed, Population = 6, Think = Distribution.Exponential(60), Entry = "n1" }],
                Nodes = [new QueueingNode { Id = "n1", Name = "Наладчики", Servers = 2, Service = Distribution.Exponential(15) }],
            }),
        new("engset", "Поведение заявок", "Модель Энгсета (конечный источник с отказами)", "10 абонентов и 3 линии без очереди: вызов при занятых линиях теряется.",
            new QueueingModel
            {
                Name = "M/M/3/3/10",
                Duration = 120_000,
                WarmUp = 6_000,
                Replications = 5,
                Classes = [new CustomerClass { Id = "subscribers", Name = "Абоненты", Kind = CustomerClassKind.Closed, Population = 10, Think = Distribution.Exponential(30), Entry = "n1" }],
                Nodes = [new QueueingNode { Id = "n1", Name = "Линии", Servers = 3, Capacity = 3, Service = Distribution.Exponential(8) }],
            }),

        // ---------------------------------------------------------------- server interruptions
        new("vacation", "Прерывания обслуживания", "M/G/1 с отпусками прибора", "Освободившись, мастер уходит на перерыв 3 мин и повторяет перерывы, пока нет заявок.",
            Single("M/G/1 с отпусками", Distribution.Exponential(10), Station("Мастер", Distribution.Uniform(2, 10)) with { Vacation = Distribution.Exponential(3) })),
        new("breakdowns", "Прерывания обслуживания", "Отказы и восстановление прибора", "Станок работает до отказа в среднем 200 мин, ремонт — 20 мин; формулы нет, только моделирование.",
            Single("M/M/1 с отказами", Distribution.Exponential(12), Station("Станок", Distribution.Exponential(8)) with
            {
                TimeToFailure = Distribution.Exponential(200), Repair = Distribution.Exponential(20),
            }, duration: 180_000, warmUp: 9_000)),

        // ---------------------------------------------------------------- networks
        new("tandem", "Сети", "Две фазы последовательно", "Регистрация и выдача: сеть Джексона из двух узлов M/M/1 и M/M/2.",
            new QueueingModel
            {
                Name = "Многофазная СМО",
                Duration = 60_000,
                WarmUp = 3_000,
                Replications = 5,
                Classes = [new CustomerClass { Id = "c1", Name = "Клиенты", Arrival = Distribution.Exponential(6), Entry = "n1" }],
                Nodes =
                [
                    new QueueingNode { Id = "n1", Name = "Регистрация", Service = Distribution.Exponential(4), Routes = [To("n2", 1)] },
                    new QueueingNode { Id = "n2", Name = "Выдача", Servers = 2, Service = Distribution.Exponential(9) },
                ],
            }),
        new("jackson", "Сети", "Сеть с контролем и возвратом", "Сборка → контроль; 20 % изделий возвращаются на доработку, 10 % — на повторную сборку.",
            new QueueingModel
            {
                Name = "Открытая сеть Джексона",
                Duration = 90_000,
                WarmUp = 6_000,
                Replications = 5,
                Classes = [new CustomerClass { Id = "c1", Name = "Изделия", Arrival = Distribution.Exponential(10), Entry = "n1" }],
                Nodes =
                [
                    new QueueingNode { Id = "n1", Name = "Сборка", Servers = 2, Service = Distribution.Exponential(12), Routes = [To("n2", 1)] },
                    new QueueingNode { Id = "n2", Name = "Контроль", Service = Distribution.Exponential(5), Routes = [To("n3", 0.2), To("n1", 0.1)] },
                    new QueueingNode { Id = "n3", Name = "Доработка", Service = Distribution.Exponential(15), Routes = [To("n2", 1)] },
                ],
            }),
        new("tandem-general", "Сети", "Конвейер с неэкспоненциальными временами", "Три операции с постоянным, равномерным и эрланговским временем: декомпозиция QNA.",
            new QueueingModel
            {
                Name = "Конвейер (QNA)",
                Duration = 120_000,
                WarmUp = 6_000,
                Replications = 5,
                Classes = [new CustomerClass { Id = "c1", Name = "Детали", Arrival = Distribution.Exponential(10), Entry = "n1" }],
                Nodes =
                [
                    new QueueingNode { Id = "n1", Name = "Резка", Service = Distribution.Deterministic(7), Routes = [To("n2", 1)] },
                    new QueueingNode { Id = "n2", Name = "Сверловка", Service = Distribution.Uniform(4, 12), Routes = [To("n3", 1)] },
                    new QueueingNode { Id = "n3", Name = "Покраска", Service = Distribution.Erlang(8, 4) },
                ],
            }),
        new("closed-network", "Сети", "Замкнутая сеть: терминалы, процессор, диски", "20 пользователей с временем раздумья 50; процессор и два диска (центральный обслуживающий узел), анализ средних значений.",
            new QueueingModel
            {
                Name = "Модель центрального сервера",
                Duration = 90_000,
                WarmUp = 6_000,
                Replications = 5,
                Classes = [new CustomerClass { Id = "users", Name = "Пользователи", Kind = CustomerClassKind.Closed, Population = 20, Think = Distribution.Exponential(50), Entry = "cpu" }],
                Nodes =
                [
                    new QueueingNode { Id = "cpu", Name = "Процессор", Service = Distribution.Exponential(0.8), Routes = [To("disk1", 0.5), To("disk2", 0.3)] },
                    new QueueingNode { Id = "disk1", Name = "Диск 1", Service = Distribution.Exponential(1.5), Routes = [To("cpu", 1)] },
                    new QueueingNode { Id = "disk2", Name = "Диск 2", Servers = 2, Service = Distribution.Exponential(4), Routes = [To("cpu", 1)] },
                ],
            }),
    ];

    public static QueueingPreset? Find(string id) => All.FirstOrDefault(preset => preset.Id == id);
}
