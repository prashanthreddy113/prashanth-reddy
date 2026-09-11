# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Marketing.Api/Marketing.Api.csproj Marketing.Api/
RUN dotnet restore Marketing.Api/Marketing.Api.csproj
COPY Marketing.Api/ Marketing.Api/
RUN dotnet publish Marketing.Api/Marketing.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
# Hosts such as Render/Railway set PORT; the app binds to it automatically.
EXPOSE 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENTRYPOINT ["dotnet", "Marketing.Api.dll"]
