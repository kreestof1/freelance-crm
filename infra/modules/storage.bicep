// modules/storage.bicep

param env string
param location string

var storageName = 'crmdocs${env}'

resource sa 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    defaultToOAuthAuthentication: true // Managed Identity preferred
    allowSharedKeyAccess: false // Force MI/SAS uniquement
  }
}

// Containers documents
var containers = ['documents-proposals', 'documents-contracts', 'documents-other']

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: sa
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    isVersioningEnabled: true
  }
}

resource docContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [
  for c in containers: {
    parent: blobService
    name: c
    properties: {
      publicAccess: 'None'
    }
  }
]

output storageAccountName string = sa.name
output storageAccountId string = sa.id
output blobEndpoint string = sa.properties.primaryEndpoints.blob
