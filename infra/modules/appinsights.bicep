// modules/appinsights.bicep

param env string
param location string
param logAnalyticsWorkspaceId string

resource ai 'Microsoft.Insights/components@2020-02-02' = {
  name: 'crm-ai-${env}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId
    RetentionInDays: env == 'prod' ? 90 : 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output instrumentationKey string = ai.properties.InstrumentationKey
output connectionString string = ai.properties.ConnectionString
output appInsightsId string = ai.id
