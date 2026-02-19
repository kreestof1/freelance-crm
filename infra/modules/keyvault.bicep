// modules/keyvault.bicep

param env string
param location string

var kvName = 'crm-kv-${env}'

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true // RBAC plutôt qu'Access Policies
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled' // Restreindre par IP en prod
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
output keyVaultId string = kv.id
