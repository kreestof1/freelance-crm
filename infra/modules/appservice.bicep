// modules/appservice.bicep

param env string
param location string
param keyVaultName string
param acrLoginServer string
param appInsightsConnectionString string

var planName = 'crm-asp-${env}'
var appName = 'crm-api-${env}'

// ── App Service Plan ──────────────────────────────────────────────────────────
resource asp 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: env == 'prod' ? 'P1v3' : 'B2'
    tier: env == 'prod' ? 'PremiumV3' : 'Basic'
  }
  properties: {
    reserved: true // Linux
  }
}

// ── App Service ───────────────────────────────────────────────────────────────
resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned' // Managed Identity pour Key Vault + ACR
  }
  properties: {
    serverFarmId: asp.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/api:latest'
      alwaysOn: true
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
      acrUseManagedIdentityCreds: true
      appSettings: [
        { name: 'ENVIRONMENT', value: env }
        { name: 'WEBSITES_PORT', value: '8000' }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'DATABASE_URL'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=postgres-connection-string)'
        }
        {
          name: 'JWT_SECRET_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=jwt-secret-key)'
        }
        {
          name: 'AZURE_STORAGE_URL'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=storage-account-connection-string)'
        }
        {
          name: 'SMTP_PASSWORD'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=smtp-password)'
        }
      ]
    }
  }
}

// ── Slot staging (prod uniquement) ────────────────────────────────────────────
resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = if (env == 'prod') {
  parent: app
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: asp.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/api:latest'
      alwaysOn: false
    }
  }
}

// ── RBAC : App Service → Key Vault Secrets User ───────────────────────────────
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Role: Key Vault Secrets User (4633458b-17de-408a-b874-0445c86b69e6)
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(app.id, kv.id, 'kv-secrets-user')
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'
    )
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output hostName string = app.properties.defaultHostName
output appServiceId string = app.id
output principalId string = app.identity.principalId
