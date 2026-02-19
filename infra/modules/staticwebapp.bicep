// modules/staticwebapp.bicep

param env string
param location string

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: 'crm-front-${env}'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

output defaultHostname string = swa.properties.defaultHostname
output swaName string = swa.name
