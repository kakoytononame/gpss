FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY GpssStudio.WebApi/GpssStudio.WebApi.csproj GpssStudio.WebApi/
RUN dotnet restore GpssStudio.WebApi/GpssStudio.WebApi.csproj

COPY GpssStudio.WebApi/. GpssStudio.WebApi/
RUN dotnet publish GpssStudio.WebApi/GpssStudio.WebApi.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final

WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "GpssStudio.WebApi.dll"]
