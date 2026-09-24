# Mana Bandi API — build context is this folder (mana-bandi/backend):
#   docker build -t manabandi-api .
#   docker run -p 5080:8080 -e ConnectionStrings__Default=... -e Jwt__Key=... -v manabandi-files:/data/files manabandi-api
# Migrations run automatically on start (DbInitializer), then launch config is seeded once.

# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ManaBandi.Api/ManaBandi.Api.csproj ManaBandi.Api/
RUN dotnet restore ManaBandi.Api/ManaBandi.Api.csproj
COPY ManaBandi.Api/ ManaBandi.Api/
RUN dotnet publish ManaBandi.Api/ManaBandi.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tzdata curl && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/files && chown -R app:app /data
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://0.0.0.0:8080 \
    Files__Root=/data/files \
    TZ=Asia/Kolkata
# Hosts such as Render/Railway set PORT; the app binds to it automatically when ASPNETCORE_URLS is unset.
EXPOSE 8080
VOLUME ["/data/files"]
USER app
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS http://localhost:8080/healthz || exit 1
ENTRYPOINT ["dotnet", "ManaBandi.Api.dll"]
