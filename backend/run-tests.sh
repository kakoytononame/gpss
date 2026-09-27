#!/bin/sh
# Runs the simulation engine unit tests and the API integration tests (needs PostgreSQL, see GPSS_TEST_DB).
set -e
dotnet test GpssStudio.Simulation.Tests/GpssStudio.Simulation.Tests.csproj -c Release --no-build --logger "console;verbosity=normal"
dotnet test GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj -c Release --no-build --logger "console;verbosity=normal"
