// modules/loganalytics.bicep

param env string
param location string

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'crm-law-${env}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: env == 'prod' ? 90 : 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceId string = law.id
output workspaceName string = law.name
