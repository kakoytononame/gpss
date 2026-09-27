FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY GpssStudio.WebApi/GpssStudio.WebApi.csproj GpssStudio.WebApi/
RUN dotnet restore GpssStudio.WebApi/GpssStudio.WebApi.csproj

COPY GpssStudio.WebApi/. GpssStudio.WebApi/
RUN dotnet publish GpssStudio.WebApi/GpssStudio.WebApi.csproj -c Release -o /app/publish /p:UseAppHost=false

# Integration tests: docker compose --profile test run --rm api-tests
FROM build AS test

COPY GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj GpssStudio.WebApi.Tests/
RUN dotnet restore GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj

COPY GpssStudio.WebApi.Tests/. GpssStudio.WebApi.Tests/
RUN dotnet build GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj -c Release --no-restore

ENTRYPOINT ["dotnet", "test", "GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj", "-c", "Release", "--no-build", "--logger", "console;verbosity=normal"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final

WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "GpssStudio.WebApi.dll"]
