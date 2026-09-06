# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Yukktha.Api/Yukktha.Api.csproj Yukktha.Api/
RUN dotnet restore Yukktha.Api/Yukktha.Api.csproj
COPY Yukktha.Api/ Yukktha.Api/
RUN dotnet publish Yukktha.Api/Yukktha.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
# Hosts such as Render/Railway set PORT; the app binds to it automatically.
EXPOSE 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENTRYPOINT ["dotnet", "Yukktha.Api.dll"]
