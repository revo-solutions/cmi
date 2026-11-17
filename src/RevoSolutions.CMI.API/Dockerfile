FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
USER $APP_UID

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["global.json", "./"]
COPY ["NuGet.Config", "./"]
COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
COPY [".editorconfig", "./"]
COPY ["src/RevoSolutions.CMI.API/RevoSolutions.CMI.API.csproj", "src/RevoSolutions.CMI.API/"]
COPY ["src/RevoSolutions.CMI.Anticorruption.ExpoPush/RevoSolutions.CMI.Anticorruption.ExpoPush.csproj", "src/RevoSolutions.CMI.Anticorruption.ExpoPush/"]
COPY ["src/RevoSolutions.CMI.Anticorruption.RevenueCat/RevoSolutions.CMI.Anticorruption.RevenueCat.csproj", "src/RevoSolutions.CMI.Anticorruption.RevenueCat/"]
COPY ["src/RevoSolutions.CMI.Anticorruption.WhatsApp/RevoSolutions.CMI.Anticorruption.WhatsApp.csproj", "src/RevoSolutions.CMI.Anticorruption.WhatsApp/"]
COPY ["src/RevoSolutions.CMI.Data.PostgreSql/RevoSolutions.CMI.Data.PostgreSql.csproj", "src/RevoSolutions.CMI.Data.PostgreSql/"]
COPY ["src/RevoSolutions.CMI.Domain/RevoSolutions.CMI.Domain.csproj", "src/RevoSolutions.CMI.Domain/"]
COPY ["src/RevoSolutions.CMI.Domain.Core/RevoSolutions.CMI.Domain.Core.csproj", "src/RevoSolutions.CMI.Domain.Core/"]
RUN dotnet restore "src/RevoSolutions.CMI.API/RevoSolutions.CMI.API.csproj"
COPY src/ src/
WORKDIR "/src/src/RevoSolutions.CMI.API"
RUN dotnet publish "RevoSolutions.CMI.API.csproj" -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "RevoSolutions.CMI.API.dll"]
