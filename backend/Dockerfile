FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY GpssStudio.Simulation/GpssStudio.Simulation.csproj GpssStudio.Simulation/
COPY GpssStudio.WebApi/GpssStudio.WebApi.csproj GpssStudio.WebApi/
RUN dotnet restore GpssStudio.WebApi/GpssStudio.WebApi.csproj

COPY GpssStudio.Simulation/. GpssStudio.Simulation/
COPY GpssStudio.WebApi/. GpssStudio.WebApi/
RUN dotnet publish GpssStudio.WebApi/GpssStudio.WebApi.csproj -c Release -o /app/publish /p:UseAppHost=false

# Integration tests: docker compose --profile test run --rm api-tests
FROM build AS test

COPY GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj GpssStudio.WebApi.Tests/
COPY GpssStudio.Simulation.Tests/GpssStudio.Simulation.Tests.csproj GpssStudio.Simulation.Tests/
RUN dotnet restore GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj && dotnet restore GpssStudio.Simulation.Tests/GpssStudio.Simulation.Tests.csproj

COPY GpssStudio.WebApi.Tests/. GpssStudio.WebApi.Tests/
COPY GpssStudio.Simulation.Tests/. GpssStudio.Simulation.Tests/
RUN dotnet build GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj -c Release --no-restore \
    && dotnet build GpssStudio.Simulation.Tests/GpssStudio.Simulation.Tests.csproj -c Release --no-restore

COPY run-tests.sh ./
ENTRYPOINT ["sh", "run-tests.sh"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final

WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "GpssStudio.WebApi.dll"]
