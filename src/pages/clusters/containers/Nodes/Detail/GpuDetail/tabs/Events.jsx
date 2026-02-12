import React from 'react'
import { toJS } from 'mobx'
import { observer } from 'mobx-react'

import { joinSelector } from 'utils'
import EventStore from 'stores/event'
import EventsCard from 'components/Cards/Events'

@observer
export default class GpuEvents extends React.Component {
  eventStore = new EventStore()

  componentDidMount() {
    this.fetchData()
  }

  componentDidUpdate(prevProps) {
    const { node, cluster } = this.props.match.params
    const prev = prevProps.match.params
    if (node !== prev.node || cluster !== prev.cluster) {
      this.fetchData()
    }
  }

  fetchData = () => {
    const { cluster, node } = this.props.match.params

    const fields = {
      'involvedObject.name': node,
      'involvedObject.kind': 'Node',
    }

    this.eventStore.fetchList({
      cluster,
      fieldSelector: joinSelector(fields),
    })
  }

  render() {
    const { data, isLoading } = toJS(this.eventStore.list)

    return (
      <div>
        <div style={{ marginBottom: 12, color: '#79879c', fontSize: 12 }}>
          {t('GPU_DETAIL_EVENTS_TIPS')}
        </div>
        <EventsCard data={data} loading={isLoading} />
      </div>
    )
  }
}
