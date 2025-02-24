import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { CpfpInfo, OptimizedMempoolStats, AddressInformation, LiquidPegs, ITranslators,
  PoolStat, BlockExtended, TransactionStripped, RewardStats, AuditScore, BlockSizesAndWeights, RbfTree, BlockAudit, Acceleration, AccelerationHistoryParams, CurrentPegs, AuditStatus, FederationAddress, FederationUtxo, RecentPeg, PegsVolume, AccelerationInfo } from '../interfaces/node-api.interface';
import { BehaviorSubject, Observable, catchError, filter, of, shareReplay, take, tap } from 'rxjs';
import { StateService } from './state.service';
import { Transaction } from '../interfaces/electrs.interface';
import { Conversion } from './price.service';
import { StorageService } from './storage.service';
import { WebsocketResponse } from '../interfaces/websocket.interface';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiBaseUrl: string; // base URL is protocol, hostname, and port
  private apiBasePath: string; // network path is /testnet, etc. or '' for mainnet

  private requestCache = new Map<string, { subject: BehaviorSubject<any>, expiry: number }>;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
    private storageService: StorageService
  ) {
    this.apiBaseUrl = ''; // use relative URL by default
    if (!stateService.isBrowser) { // except when inside AU SSR process
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.apiBasePath = ''; // assume mainnet by default
    this.stateService.networkChanged$.subscribe((network) => {
      if (network === 'bisq' && !this.stateService.env.BISQ_SEPARATE_BACKEND) {
        network = '';
      }
      this.apiBasePath = network ? '/' + network : '';
    });
  }

  private generateCacheKey(functionName: string, params: any[]): string {
    return functionName + JSON.stringify(params);
  }

  // delete expired cache entries
  private cleanExpiredCache(): void {
    this.requestCache.forEach((value, key) => {
      if (value.expiry < Date.now()) {
        this.requestCache.delete(key);
      }
    });
  }

  cachedRequest<T, F extends (...args: any[]) => Observable<T>>(
    apiFunction: F,
    expireAfter: number, // in ms
    ...params: Parameters<F>
  ): Observable<T> {
    this.cleanExpiredCache();

    const cacheKey = this.generateCacheKey(apiFunction.name, params);
    if (!this.requestCache.has(cacheKey)) {
      const subject = new BehaviorSubject<T | null>(null);
      this.requestCache.set(cacheKey, { subject, expiry: Date.now() + expireAfter });

      apiFunction.bind(this)(...params).pipe(
        tap(data => {
          subject.next(data as T);
        }),
        catchError((error) => {
          subject.error(error);
          return of(null);
        }),
        shareReplay(1),
      ).subscribe();
    }

    return this.requestCache.get(cacheKey).subject.asObservable().pipe(filter(val => val !== null), take(1));
  }

  list2HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/2h');
  }

  list24HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/24h');
  }

  list1WStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1w');
  }

  list1MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1m');
  }

  list3MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/3m');
  }

  list6MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/6m');
  }

  list1YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1y');
  }

  list2YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/2y');
  }

  list3YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/3y');
  }

  list4YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/4y');
  }

  listAllTimeStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/all');
  }

  getTransactionTimes$(txIds: string[]): Observable<number[]> {
    let params = new HttpParams();
    txIds.forEach((txId: string) => {
      params = params.append('txId[]', txId);
    });
    return this.httpClient.get<number[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/transaction-times', { params });
  }

  getAboutPageProfiles$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/services/sponsors');
  }

  getOgs$(): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/donations');
  }

  getTranslators$(): Observable<ITranslators> {
    return this.httpClient.get<ITranslators>(this.apiBaseUrl + '/api/v1/translators');
  }

  getContributor$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/contributors');
  }

  getInitData$(): Observable<WebsocketResponse> {
    return this.httpClient.get<WebsocketResponse>(this.apiBaseUrl + this.apiBasePath + '/api/v1/init-data');
  }

  getCpfpinfo$(txid: string): Observable<CpfpInfo> {
    return this.httpClient.get<CpfpInfo>(this.apiBaseUrl + this.apiBasePath + '/api/v1/cpfp/' + txid);
  }

  validateAddress$(address: string): Observable<AddressInformation> {
    return this.httpClient.get<AddressInformation>(this.apiBaseUrl + this.apiBasePath + '/api/v1/validate-address/' + address);
  }

  getRbfHistory$(txid: string): Observable<{ replacements: RbfTree, replaces: string[] }> {
    return this.httpClient.get<{ replacements: RbfTree, replaces: string[] }>(this.apiBaseUrl + this.apiBasePath + '/api/v1/tx/' + txid + '/rbf');
  }

  getRbfCachedTx$(txid: string): Observable<Transaction> {
    return this.httpClient.get<Transaction>(this.apiBaseUrl + this.apiBasePath + '/api/v1/tx/' + txid + '/cached');
  }

  getRbfList$(fullRbf: boolean, after?: string): Observable<RbfTree[]> {
    return this.httpClient.get<RbfTree[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/' + (fullRbf ? 'fullrbf/' : '') + 'replacements/' + (after || ''));
  }

  liquidPegs$(): Observable<CurrentPegs> {
    return this.httpClient.get<CurrentPegs>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/pegs');
  }

  pegsVolume$(): Observable<PegsVolume[]> {
    return this.httpClient.get<PegsVolume[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/pegs/volume');
  }

  listLiquidPegsMonth$(): Observable<LiquidPegs[]> {
    return this.httpClient.get<LiquidPegs[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/pegs/month');
  }

  liquidReserves$(): Observable<CurrentPegs> {
    return this.httpClient.get<CurrentPegs>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves');
  }

  listLiquidReservesMonth$(): Observable<LiquidPegs[]> {
    return this.httpClient.get<LiquidPegs[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/month');
  }

  federationAuditSynced$(): Observable<AuditStatus> {
    return this.httpClient.get<AuditStatus>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/status');
  }

  federationAddresses$(): Observable<FederationAddress[]> {
    return this.httpClient.get<FederationAddress[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/addresses');
  }

  federationUtxos$(): Observable<FederationUtxo[]> {
    return this.httpClient.get<FederationUtxo[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/utxos');
  }

  expiredUtxos$(): Observable<FederationUtxo[]> {
    return this.httpClient.get<FederationUtxo[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/utxos/expired');
  }

  emergencySpentUtxos$(): Observable<FederationUtxo[]> {
    return this.httpClient.get<FederationUtxo[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/utxos/emergency-spent');
  }

  recentPegsList$(count: number = 0): Observable<RecentPeg[]> {
    return this.httpClient.get<RecentPeg[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/pegs/list/' + count);
  }

  pegsCount$(): Observable<any> {
    return this.httpClient.get<number>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/pegs/count');
  }

  federationAddressesNumber$(): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/addresses/total');
  }

  federationUtxosNumber$(): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/utxos/total');
  }

  emergencySpentUtxosStats$(): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/reserves/utxos/emergency-spent/stats');
  }

  listFeaturedAssets$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/assets/featured');
  }

  getAssetGroup$(id: string): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/api/v1/assets/group/' + id);
  }

  postTransaction$(hexPayload: string): Observable<any> {
    return this.httpClient.post<any>(this.apiBaseUrl + this.apiBasePath + '/api/tx', hexPayload, { responseType: 'text' as 'json'});
  }

  listPools$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pools` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }  

  getPoolStats$(slug: string): Observable<PoolStat> {
    return this.httpClient.get<PoolStat>(this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pool/${slug}`);
  }

  getPoolHashrate$(slug: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pool/${slug}/hashrate`);
  }

  getPoolBlocks$(slug: string, fromHeight: number): Observable<BlockExtended[]> {
    return this.httpClient.get<BlockExtended[]>(
        this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pool/${slug}/blocks` +
        (fromHeight !== undefined ? `/${fromHeight}` : '')
      );
  }

  getBlocks$(from: number): Observable<BlockExtended[]> {
    return this.httpClient.get<BlockExtended[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/blocks` +
      (from !== undefined ? `/${from}` : ``)
    );
  }

  getBlock$(hash: string): Observable<BlockExtended> {
    return this.httpClient.get<BlockExtended>(this.apiBaseUrl + this.apiBasePath + '/api/v1/block/' + hash);
  }

  getBlockDataFromTimestamp$(timestamp: number): Observable<any> {
    return this.httpClient.get<number>(this.apiBaseUrl + this.apiBasePath + '/api/v1/mining/blocks/timestamp/' + timestamp);
  }

  getStrippedBlockTransactions$(hash: string): Observable<TransactionStripped[]> {
    return this.httpClient.get<TransactionStripped[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/block/' + hash + '/summary');
  }

  getDifficultyAdjustments$(interval: string | undefined): Observable<any> {
    return this.httpClient.get<any[]>(
        this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/difficulty-adjustments` +
        (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
      );
  }

  getHistoricalHashrate$(interval: string | undefined): Observable<any> {
    return this.httpClient.get<any[]>(
        this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/hashrate` +
        (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
      );
  }

  getHistoricalPoolsHashrate$(interval: string | undefined): Observable<any> {
    return this.httpClient.get<any[]>(
        this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/hashrate/pools` +
        (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
      );
  }

  getHistoricalBlockFees$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/fees` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getHistoricalBlockRewards$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/rewards` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getHistoricalBlockFeeRates$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/fee-rates` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getHistoricalBlockSizesAndWeights$(interval: string | undefined) : Observable<HttpResponse<BlockSizesAndWeights>> {
    return this.httpClient.get<BlockSizesAndWeights>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/sizes-weights` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getHistoricalBlocksHealth$(interval: string | undefined) : Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/predictions` +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getBlockAudit$(hash: string) : Observable<BlockAudit> {
    return this.httpClient.get<BlockAudit>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/block/${hash}/audit-summary`
    );
  }

  getBlockAuditScores$(from: number): Observable<AuditScore[]> {
    return this.httpClient.get<AuditScore[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/audit/scores` +
      (from !== undefined ? `/${from}` : ``)
    );
  }

  getBlockAuditScore$(hash: string) : Observable<any> {
    return this.httpClient.get<any>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/blocks/audit/score/` + hash
    );
  }

  getRewardStats$(blockCount: number = 144): Observable<RewardStats> {
    return this.httpClient.get<RewardStats>(this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/reward-stats/${blockCount}`);
  }

  getEnterpriseInfo$(name: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + `/api/v1/services/enterprise/info/` + name);
  }

  getChannelByTxIds$(txIds: string[]): Observable<any[]> {
    let params = new HttpParams();
    txIds.forEach((txId: string) => {
      params = params.append('txId[]', txId);
    });
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/channels/txids/', { params });
  }

  lightningSearch$(searchText: string): Observable<any[]> {
    let params = new HttpParams().set('searchText', searchText);
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/search', { params });
  }

  getNodesPerIsp(): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/isp-ranking');
  }

  getNodeForCountry$(country: string): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/country/' + country);
  }

  getNodeForISP$(isp: string): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/isp/' + isp);
  }

  getNodesPerCountry$(): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/countries');
  }

  getWorldNodes$(): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/world');
  }

  getChannelsGeo$(publicKey?: string, style?: 'graph' | 'nodepage' | 'widget' | 'channelpage'): Observable<any> {
    return this.httpClient.get<any[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/channels-geo' +
        (publicKey !== undefined ? `/${publicKey}`   : '') +
        (style     !== undefined ? `?style=${style}` : '')
    );
  }

  getHistoricalPrice$(timestamp: number | undefined): Observable<Conversion> {
    if (this.stateService.isAnyTestnet()) {
      return of({
        prices: [],
        exchangeRates: {
          USDEUR: 0,
          USDGBP: 0,
          USDCAD: 0,
          USDCHF: 0,
          USDAUD: 0,
          USDJPY: 0,
        }
      });
    }
    return this.httpClient.get<Conversion>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/historical-price' +
        (timestamp ? `?timestamp=${timestamp}` : '')
    );
  }

  getAccelerationsByPool$(slug: string): Observable<AccelerationInfo[]> {
    return this.httpClient.get<AccelerationInfo[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/accelerations/pool/${slug}`
    );
  }

  getAccelerationsByHeight$(height: number): Observable<AccelerationInfo[]> {
    return this.httpClient.get<AccelerationInfo[]>(
      this.apiBaseUrl + this.apiBasePath + `/api/v1/accelerations/block/${height}`
    );
  }

  getRecentAccelerations$(interval: string | undefined): Observable<AccelerationInfo[]> {
    return this.httpClient.get<AccelerationInfo[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/accelerations/interval' + (interval !== undefined ? `/${interval}` : '')
    );
  }
}
