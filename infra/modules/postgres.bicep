// modules/postgres.bicep

param env string
param location string
param adminLogin string
@secure()
param adminPassword string

var dbName = 'crm-db-${env}'

// SKU selon l'environnement
var skuName = env == 'prod' ? 'Standard_D2s_v3' : 'Standard_B1ms'
var skuTier = env == 'prod' ? 'GeneralPurpose' : 'Burstable'
var backupRetention = env == 'prod' ? 35 : 7

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: dbName
  location: location
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    version: '15'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: backupRetention
      geoRedundantBackup: env == 'prod' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled' // Activer SameZone en prod si besoin
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
    network: {
      publicNetworkAccess: 'Enabled' // Remplacer par 'Disabled' + PE en prod v1.1
    }
  }
}

// Base de données CRM
resource crmDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: 'crm'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Règle firewall — Azure Services
resource firewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output fqdn string = postgres.properties.fullyQualifiedDomainName
output serverName string = postgres.name
