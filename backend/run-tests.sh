#!/bin/sh
# Runs the simulation engine and project import/generation unit tests and the API integration tests
# (needs PostgreSQL, see GPSS_TEST_DB). GPSS_STUDIO_SAMPLES enables the checks against GPSS Studio samples.
set -e
dotnet test GpssStudio.Simulation.Tests/GpssStudio.Simulation.Tests.csproj -c Release --no-build --logger "console;verbosity=normal"
dotnet test GpssStudio.Projects.Tests/GpssStudio.Projects.Tests.csproj -c Release --no-build --logger "console;verbosity=normal"
dotnet test GpssStudio.WebApi.Tests/GpssStudio.WebApi.Tests.csproj -c Release --no-build --logger "console;verbosity=normal"
