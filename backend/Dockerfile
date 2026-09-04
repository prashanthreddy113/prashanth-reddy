# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY StudyRoom.Api/StudyRoom.Api.csproj StudyRoom.Api/
RUN dotnet restore StudyRoom.Api/StudyRoom.Api.csproj
COPY StudyRoom.Api/ StudyRoom.Api/
RUN dotnet publish StudyRoom.Api/StudyRoom.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
# Hosts such as Render/Railway set PORT; the app binds to it automatically.
EXPOSE 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENTRYPOINT ["dotnet", "StudyRoom.Api.dll"]
