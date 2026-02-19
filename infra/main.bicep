// infra/main.bicep — Orchestrateur principal
// Déployer : az deployment group create -g crm-freelance-dev -f infra/main.bicep -p infra/environments/dev.parameters.json

targetScope = 'resourceGroup'

@description('Suffixe d'environnement : dev | staging | prod')
@allowed(['dev', 'staging', 'prod'])
param env string = 'dev'

@description('Région Azure')
param location string = resourceGroup().location

@description('Login administrateur PostgreSQL')
param postgresAdminLogin string

@description('Mot de passe administrateur PostgreSQL (Key Vault en prod)')
@secure()
param postgresAdminPassword string

@description('Serveur ACR (ex: crmacr.azurecr.io)')
param acrLoginServer string = ''

// ── Modules ────────────────────────────────────────────────────────────────────

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    env: env
    location: location
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    env: env
    location: location
  }
}

module loganalytics 'modules/loganalytics.bicep' = {
  name: 'loganalytics'
  params: {
    env: env
    location: location
  }
}

module appinsights 'modules/appinsights.bicep' = {
  name: 'appinsights'
  params: {
    env: env
    location: location
    logAnalyticsWorkspaceId: loganalytics.outputs.workspaceId
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    env: env
    location: location
    adminLogin: postgresAdminLogin
    adminPassword: postgresAdminPassword
  }
}

module appservice 'modules/appservice.bicep' = {
  name: 'appservice'
  params: {
    env: env
    location: location
    keyVaultName: keyvault.outputs.keyVaultName
    acrLoginServer: acrLoginServer
    appInsightsConnectionString: appinsights.outputs.connectionString
  }
  dependsOn: [keyvault, postgres, storage, appinsights]
}

module swa 'modules/staticwebapp.bicep' = {
  name: 'swa'
  params: {
    env: env
    location: location
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────────
output appServiceHostName string = appservice.outputs.hostName
output swaUrl string = swa.outputs.defaultHostname
output postgresHost string = postgres.outputs.fqdn
output keyVaultUri string = keyvault.outputs.keyVaultUri
