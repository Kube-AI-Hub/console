/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */
module.exports = {
  // Title
  // Navigation Pane > Cluster
  METERING_NOT_ENABLED_DESC: '이 모듈은 활성화되지 않았습니다. <a href="{docUrl}/toolbox/metering-and-billing/enable-billing/">자세히 알아보기</a>',
  NO_METER_DATA: '리소스 사용 데이터를 찾을 수 없습니다.',
  // Navigation Pane > Cluster Node
  // Navigation Pane > Cluster Node > Pod
  // Navigation Pane > Checkbox
  EXPORT_BILL: 'CSV 파일 형식으로 사용 기록을 내보냅니다.',
  // Resource Consumption Statictics
  TOTAL_COST: '전체 비용({unit})',
  PRICE_CONFIG_DESC: '가격 정보가 설정되지 않았습니다.',
  METER_CPU_USAGE: 'CPU 사용량',
  METER_MEMORY_USAGE: '메모리 사용량',
  METER_GPU_USAGE: 'GPU 사용량',
  METER_GPU_MEMORY_USAGE: 'GPU 메모리 사용량',
  METER_GPU_ALLOCATED: 'GPU 할당량',
  COMPUTE_RESOURCE: '컴퓨팅 리소스',
  STORAGE_AND_NETWORK: '스토리지 및 네트워크',
  GPU_MODEL_CONSUMPTION: 'GPU 모델별 사용량',
  GPU_MODEL_CONSUMPTION_DESC: '카드 모델별로 GPU 사용량, 메모리, 할당량을 집계합니다. 비용은 할당량 × 모델 단가로 계산됩니다.',
  GPU_MODEL_HISTORY_HINT: '모델별 집계 규칙은 적용된 이후부터 데이터가 쌓입니다. 규칙을 방금 추가한 경우 이 표의 기간 합계는 위의 GPU 합계보다 작을 수 있으며, 평균/최댓값은 노드 현황과 일치해야 합니다.',
  UNKNOWN_GPU_MODEL: '알 수 없는 모델',
  NO_GPU_METER_DATA: '이 기간에 GPU 사용량이 없습니다',
  NO_GPU_METER_DATA_DESC: '선택한 기간에 모델별 GPU 소비 데이터가 없습니다.',
  METER_VOLUME_USAGE: '볼륨 사용량',
  METER_NET_RECEIVED_USAGE: '인바운드 트래픽 사용량',
  METER_NET_TRANSMITTED_USAGE: '아웃바운드 트래픽 사용량',
  NET_RECEIVED: '인바운드 트래픽',
  NET_TRANSMITTED: '아웃바운드 트래픽',
  COMPOSING_APP: 'Composed 앱',
  CLUSTER_NODE_SCAP: '클러스터 노드',
  POD_SCAP: '파드',
  APP_TEMPLATE_SCAP: '템플릿 추가',
  COMPOSING_APP_SCAP: 'Composed 앱',
  DEPLOYMENT_SCAP: '디플로이먼트',
  STATEFULSET_SCAP: '스테이트풀셋',
  DAEMONSET_SCAP: '데몬셋',
  WORKSPACE_SCAP: '워크스페이스',
  CLUSTER_SCAP: '클러스터',
  PROJECT_SCAP: '프로젝트',
  SERVICE_SCAP: '서비스',
  HOST_CLUSTER_SCAP: '호스트 클러스터',
  MEMBER_CLUSTER_SCAP: '맴버 클러스터',
  // Consumtion History
  CONSUMPTION_HISTORY: '소비 내역',
  BILLING_CYCLE: '결제 주기',
  CONSUMER_TRENDS: '비용 추이',
  AVERAGE_USAGE: '평균 사용량',
  TOTAL_CONSUMPTION: '총 소비량',
  TOTAL_CONSUMPTION_Q: '총 소비량은 얼마입니까?',
  TOTAL_CONSUMPTION_A: '총 사용량은 현재 청구 주기에서 샘플링 포인트당 리소스 사용량의 합계입니다.',
  TIMERANGE_MORE_30DAY_MSG: '종료 시간과 시작 시간 사이의 간격이 30일보다 크면 최소 샘플링 간격은 1일이어야 합니다.',
  MAXIMUM_USAGE: '최대 사용량',
  MINIMUM_USAGE: '최소 사용량',
  RESOURCE_TYPE: '리소스 유형',
  // Current Consumption
  CURRRENT_RESOURCE_CONSUMPTION: '현재 소비량',
  // Current Consumption > Tip
  METER_RESOURCE_DESC: '1시간 이내에 리소스 소비량'
};